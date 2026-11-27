# Operator guide

**Current scope:** the following operator procedures are reference material, not active instructions. The authenticated live driver gate is closed. No requests, session changes, signing or deployment are authorized. See [verification](VERIFICATION.md) and [isolated acceptance scope](RELEASE-ACCEPTANCE.md) for what has actually been tested.

## Start an agent session

Read the authenticated status endpoint. Wait for bridge state `ready`. A
driver health check only says the HTTP process is running; it does not prove
Firefox is connected. Ensure the intended container by exact name, then list
its tabs. Reuse an existing appropriate tab or create one and retain the actual
`tabId` returned by the API.

Container appearance is optional data on `containers.ensure`. For example,
use blue/fingerprint for ChatGPT 1 and orange/briefcase for ChatGPT 2. Calling
ensure twice returns the same cookie store. Two existing identities with the
same name cause an explicit error; do not choose by list position.

## Read and interact

Use `tabs.readText` for the current page and a specific CSS selector when only
one section matters. The result reports truncation. Use `tabs.eval` with
`probe: elements` to inspect the proposed target's tag, ID, role and label.
Selectors must resolve to exactly one element for clicks or typing.

`tabs.type` changes text but does not submit it. It uses the native value
setter for input/textarea and browser editing or DOM input for contenteditable
fields. It checks the retained result before reporting success. Password,
one-time-code, file and recognized credential fields are rejected.

For ChatGPT, inspect the live composer and send button first; selectors are
not permanently guaranteed by this project. Once the composer is verified,
type the authorized prompt, confirm the returned value, then call `tabs.click`
on the verified send button. That method calls the element's `.click()`
directly. Do not retry failed physical mouse events or rely on Enter. Confirm
the composer cleared and the sent message appears before counting it as sent.
Never send while a response is still running. Follow the operator's conversation
limits and cadence for ongoing ChatGPT work.

Do not automate login, password entry, authentication codes or account creation.
If the page requires login, the owner signs in once in that named container.

## Errors and recovery

| Error | Action |
| --- | --- |
| `BROWSER_UNAVAILABLE` | Inspect Firefox startup, policy install and managed secret; no command was sent |
| `CONTAINER_NOT_FOUND` | Ensure the exact intended name |
| `CONTAINER_AMBIGUOUS` | Resolve duplicate names deliberately; never guess a cookie store |
| `CONTAINER_MISMATCH` | Refresh the intended container's tab list |
| `TARGET_CHANGED` / `DOCUMENT_UNAVAILABLE` | Read the current page and select the target again |
| `ELEMENT_AMBIGUOUS` | Narrow the selector; no click should be inferred |
| `TYPE_NOT_APPLIED` | Inspect the real composer; no send is performed by type |
| `COMMAND_TIMEOUT` / `BRIDGE_DISCONNECTED` | Inspect whether the action already ran; do not replay blindly |
| `REMOTE_CODE_FORBIDDEN` | Use a packaged probe or fixed command; arbitrary JS is unsupported |
| `RESULT_TOO_LARGE` | Read a smaller section or reduce maxLength |
| `BUSY` / `QUEUE_FULL` | Wait for in-flight work; avoid creating a retry storm |

The extension reconnects automatically with bounded backoff. A driver or app
restart discards pending requests and never replays them. After restart verify
the same container IDs and fixture sessions before continuing a workflow.

## Verify separation without logins

Open `http://driver:8080/fixtures/session?slot=A` in ChatGPT 1 and
`http://driver:8080/fixtures/session?slot=B` in ChatGPT 2. Read each page.
Then navigate both tabs to `http://driver:8080/fixtures/session` without the
query and read them again. Each must still show its own `Cookie session` and
`Local storage` marker. The packaged storage probe reads only that fixed local
storage key. Run this again after app restart to check persistence.

These pages are internal diagnostics and contain no real account data. Their
composer can exercise DOM editing, but its success is not a substitute for the
real ChatGPT composer acceptance check.

## Updates, secrets and rollback

Changing extension code requires a new version and a newly signed XPI. Never
edit a signed archive. Validate and commit the exact signed artifact before
building the custom image. Runtime token changes do not require resigning;
update the shared managed secret through the vault, then restart both services
so Firefox rereads it.

Keep the API key distinct from the WS token. Do not display resolved environment
variables, print Compose configuration containing secrets, or send key values
in chat. Use the API client with a mounted secret file.

Use the [deployment guide](DEPLOYMENT.md) for rollback. Retain the previous
image digest and exact deployment settings. Never delete the existing home
volume, run `down -v`, or start a second Firefox against the same profile.
