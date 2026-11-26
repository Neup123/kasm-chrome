# Driver service

The Node service brokers one policy-installed Firefox companion extension. It
listens on private port 8080. Docker `EXPOSE` is metadata, not a published port.
Only `/agent-driver/v1/` is eligible for the configured HTTPS Traefik router;
the WebSocket and placeholder fixtures remain private to the Compose network.

## Configuration

| Input | Default file | Meaning |
| --- | --- | --- |
| `DRIVER_API_KEY_FILE` | `/run/secrets/driver_api_key` | Distinct random API key, 32 bytes or more encoded as base64url |
| `DRIVER_MANAGED_STORAGE_FILE` | `/run/secrets/driver_managed_storage` | Firefox native managed-storage JSON, containing `data.wsToken` and `data.wsUrl` |

The managed-storage manifest must identify `kasm-agent@chabad.gr`, use type
`storage`, and set `data.wsUrl` to `ws://driver:8080/ws`. The token must be
distinct from the API key. The service fails closed if either mounted secret
is missing or invalid. Secret contents, parser excerpts and file paths are not
included in startup failures.

## HTTPS API

Every API request requires the `X-API-Key` header. Browser `Origin` headers are
rejected; use a server-side HTTP client. CORS is not enabled. Keys are never
accepted in URLs. The API is synchronous: the POST finishes when the extension
replies or the command fails/times out.

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/agent-driver/v1/status` | Bridge state/version and pending command count |
| `POST` | `/agent-driver/v1/commands` | Direct command object; optional `id` and `timeoutMs` |
| `GET` | `/agent-driver/v1/openapi.json` | Authenticated OpenAPI definition |

`/healthz` is an internal container liveness endpoint; it intentionally does
not report browser state. It is not mapped by the public API router.

The POST body uses the shared `extension/protocol.js` contract. If `id` is
omitted the service generates a UUID. `timeoutMs` defaults to 15000 and accepts
100–60000. The driver overwrites any supplied `deadline` with its own epoch
millisecond deadline and removes `timeoutMs` before forwarding.

Replies use `{id,ok:true,result}` or
`{id,ok:false,error:{code,message}}`. A successful DOM dispatch is not proof
that the target application accepted an action; read back the resulting page
state before treating it as complete.

| HTTP status | Meaning |
| --- | --- |
| 200 | Successful reply, status or specification |
| 400 | Invalid JSON, fields, timeout, prohibited URL or arbitrary remote code |
| 401 | Missing or invalid API key |
| 403 | Browser-origin API request |
| 409 | Reused request ID |
| 413 / 415 | Oversized body / wrong content type |
| 422 | Extension reported a structured command error |
| 429 | Capacity reached; command was not dispatched |
| 502 | Invalid extension reply |
| 503 | Browser unavailable or transport lost |
| 504 | Command deadline exceeded |

## WebSocket and delivery guarantees

The extension connects to `/ws?token=…` with its native `moz-extension://`
Origin. The server requires the shared token, exactly one token parameter,
no other query parameters and an extension Origin. An Origin is not identity
proof; the random shared token authenticates the extension. A second
connection is refused and cannot evict the active browser.

The upgrade must also use the literal raw path `/ws`, Host `driver:8080`, and
no `Forwarded` or `X-Forwarded-*` headers. Traversal and encoded-path aliases
cannot escape the public API route into the private WebSocket, even if a
reverse proxy normalizes URLs differently. Private fixtures reject forwarding
headers as well.

The first message must be
`{type:"hello",protocolVersion:1,extensionVersion:"0.1.0"}` with the extension's
actual version. Only then can commands be sent. The server uses native WS
ping/pong and disconnects dead peers. JSON messages and HTTP bodies are bounded
to the shared 512 KiB limit; at most 32 commands may be in flight.

The bridge state has one writer, `transitionBridge`:

| From | To | Effect |
| --- | --- | --- |
| disconnected | handshaking | Attach one authenticated socket; start hello/heartbeat timers |
| handshaking | ready | Compatible hello received; clear hello timer |
| handshaking or ready | disconnected | Clear timers and peer; fail all pending commands |

Each command is created as `pending`. The single writer `finishCommand` moves
it to exactly one of `succeeded`, `failed`, `timed_out`, clears its timer,
removes it from pending work, logs metadata, and completes the HTTP response.
`TERMINAL_COMMANDS` is the single definition of final command states.

Accepted request IDs are retained for 15 minutes, up to 10000 entries. Capacity
exhaustion rejects new work instead of evicting replay protection. The memory
is reset on service restart. Use fresh IDs for genuinely new actions and never
automatically retry a mutation after a lost connection or timeout. Such a
command **may already have run**. Late responses are discarded; reconnection
never replays pending or completed commands. Deadlines prevent new execution
after expiration but cannot undo a DOM action that already started.

Audit logs contain bridge state or command ID, command name, duration, final
state and error code. They omit command bodies, selectors, container names,
page text, URLs, result data, query strings and error messages. Known secrets
are redacted even if accidentally used as a request ID.

## Placeholder fixture

`http://driver:8080/fixtures/session?slot=A` sets a benign `kasm_probe=A`
persistent HttpOnly cookie (one-hour lifetime) and a matching `localStorage.kasm_probe`. `slot=B` sets B.
Revisit `/fixtures/session` without `slot` to observe persisted state. The page
shows the cookie session in its text and has textarea/contenteditable inputs
plus a programmatic click target for local DOM verification. It never logs in
to a service. Fixture paths require Host `driver:8080` and are outside the
Traefik API route; the Host check is an extra guard, not a substitute for
private network routing.

## Verification scope

Run `node --test tests/driver.test.js`. The tests open real local HTTP and
WebSocket sockets and exercise auth, hello readiness, dispatch/correlation,
timeouts, duplicate IDs/connections, disconnect/reconnect, malformed replies,
limits, redacted logs and placeholder behavior. They do not establish a live
Kasm deployment, AMO acceptance, Firefox policy install, actual container
isolation, ChatGPT operation, Authelia routing or Docker volume preservation.

The service uses Node's maintained HTTP implementation and the maintained
[`ws` library](https://github.com/websockets/ws) for RFC6455 framing,
authenticated `handleUpgrade` and native heartbeat support. No custom
WebSocket framing or browser debugging protocol is implemented.

### Conversation controls (0.1.2)
 
All use the existing named container, tab ID, document token, deadline and replay
guard. No automatic approval or retry occurs. `tabs.setEffort` and
`tabs.approve` are restricted to https://chatgpt.com, not the fixture.
 
- `tabs.setEffort`, `effort: "Low" | "Medium" | "High"`: locate the composer,
  open the effort picker, drag the identified track and verify the composer
  label. No Pro selection. Unknown or ambiguous markup, or a label that does
  not change, fails explicitly.
- `tabs.approve`: omit `service` for read-only inspection, returning
  `found`, exact question and description text, and `approved:false`.
  For a grant, explicitly supply the exact service name (e.g. `"GitHub"`).
  The packaged action matches the question, opens the Approval options menu,
  checks the second item's exact full-conversation label, and verifies that
  the form disappears. It never activates Allow once, guesses a menu item, or
  grants an unrequested service. A timeout after activation is an unknown
  outcome; inspect before retrying. English UI wording is required.
- `tabs.key`, `key: "Escape"`, `"Enter"`, `"ArrowDown"`, or
  `"Ctrl+Shift+M"`: dispatch bounded synthetic keydown/keyup events on the
  target document's focused element. These are not trusted native input,
  cannot invoke browser-level shortcuts or guarantee default browser editing
  or form submission. The result reports dispatch and default prevention,
  not application acceptance. Password/file/credential inputs are excluded.
 
The effort geometry and approval markup are based on reported UI observations
and synthetic fixtures; no claim of real ChatGPT compatibility is made until
a separately authorized, isolated account acceptance check. The existing
signed 0.1.1 artifact remains historical and must not be used to build 0.1.2.
