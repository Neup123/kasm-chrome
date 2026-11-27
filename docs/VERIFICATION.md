# Verification record

## Current release evidence (2026-11-27)

The isolated integration branch `test/release-0.1.2-coolify-acceptance` contains signed 0.1.3, despite its historical name. See [current evidence and exact provenance](RELEASE-ACCEPTANCE-EVIDENCE.md) and [isolated stack scope](RELEASE-ACCEPTANCE.md). The historical 0.1.0 record below is retained for traceability, not current release status.

| Original acceptance criterion | Proven by repository/CI evidence | Still unproven on deployed isolated stack |
| --- | --- | --- |
| Policy installation | Signed 0.1.3 active in stock Firefox Release 160.0.1 in CI | Actual installed extension and ready bridge |
| Two named containers visible in desktop UI | Named contexts created via CI API | Actual desktop display and icon/color |
| ChatGPT tab in named context | Fresh internal fixture tab created in isolated CI | Actual ChatGPT tab and named-context binding |
| Read/type/send | Internal fixture type/click/readback in real Firefox | Authenticated composer, real conversation send/readback |
| Reconnect after restart | Earlier ESR and [signed Release restart fixture job 140511960304](https://github.com/Neup123/kasm-chrome/actions/runs/46000898359/job/140511960304): signed Release disposable driver/browser restart, reconnect and marker persistence | Current deployed stack reconnect and persistence |
| Independent sessions | Signed Release fixture cookies and localStorage isolated, including both disposable CI restarts | Two actual deployed test contexts |
| Proxy authentication | Isolated gateway CI rejects unauthorized browser/API access | Live HTTPS routing and authentication; production Authelia explicitly outside scope |
| Rollback and volume preservation | Separate source-defined profile volume and no shared host ports in CI | Runtime mount identity, backup/restore and rollback demonstration |

All eight original deployed acceptance criteria remain NOT RUN in the current authenticated live acceptance scope. Real control-specific tests also remain NOT RUN. The completed deployment receipt does not certify runtime health; no new live probe or deployment is authorized. The main branch artifact promotion in #14 does not establish any production runtime change.

## Historical record: release 0.1.0 (2026-11-22)

**Source and local behavior are tested. The extension is unsigned. No production
deployment or live acceptance is claimed.**

## Firefox runtime follow-up (2026-11-24)

The old policy-installed Mozilla-signed XPI loaded in stock Firefox 160.0.1,
but did not complete the driver hello. Bind the browser timers to their
global receiver. Content-script bootstrap on the internal HTTP fixture also
failed because `crypto.randomUUID` needs a secure context; the fix retains
a 128-bit cryptographic document token with `crypto.getRandomValues`.

The corrected source was temporarily installed for development in an isolated,
real Firefox profile, with a loopback driver and synthetic data only.
Observed: ready handshake, two named contexts with independent cookies and
localStorage, placeholder type/click/readback, wrong-context rejection, and
reconnection after restarting the driver. This did not start KasmVNC, use
ChatGPT or verify Coolify, signatures for the changed source, proxy routing,
or the deployment volume. Build and sign 0.1.1 via the existing AMO release
workflow before promotion; 0.1.0 does not match these sources.

## Local evidence

| Check | Result | Coverage |
| --- | --- | --- |
| `npm test` | PASS: 48 tests | Real local HTTP/WebSocket sockets; mocked Firefox API; jsdom; shared protocol; XPI integrity gates |
| `npm run lint:extension` | PASS: 0 errors, 0 notices, 0 warnings | Mozilla web-ext/addons-linter source checks; not AMO acceptance |
| `npm run check:compose` | PASS | Source invariants for ports, volume, network, secrets, routes, policies and inherited startup |
| `node scripts/generate-api-docs.js --check` | PASS | OpenAPI matches the shared command definition |
| `npm run build:extension` | PASS | Unsigned XPI produced from the exact extension source |
| `python3 scripts/verify-xpi.py artifacts/kasm-agent-unsigned.xpi` | PASS | Correct extension ID/version, file identity and host scope; signature absent as expected |

The locally built unsigned XPI SHA-256 was
`05d6c591d4a429999c6833a2e2b486956f330d92d519124714d3e7ce9ae68318`.
Packaging may produce a new archive hash when ZIP timestamps differ; source
equality is checked independently. A signed artifact has its own recorded hash.

Socket tests cover missing/wrong keys, extension token and Origin, readiness
handshake, correlation, duplicated IDs/peers, bounded bodies/concurrency,
timeouts, late replies, disconnect/reconnect without replay, malformed messages,
private fixtures and secret-free logs. A review found and fixed URL normalization
that could have made an API-prefixed traversal reach `/ws`; raw-path, Host and
forwarding-header regression tests now reject it.

Extension tests cover named-container ownership, duplicate names, default-store
rejection, exact origins, document binding, navigation/expiration/stale-connection
races, direct verified clicks, native setters, rich-text paths, retained input,
credential-field rejection, bounded Unicode payloads and retry bookkeeping.

Artifact tests explicitly prove that unsigned packages, modified source and
metadata hash mismatches are rejected by the deployment artifact gate. The
signature-structure test uses a fake fixture and asserts that it **never** claims
cryptographic trust.

## Live acceptance: 0 of 8 proven

| # | Requested live evidence | Status | Missing evidence |
| --- | --- | --- | --- |
| 1 | Policy installs extension on first boot | NOT_RUN | AMO signature, custom image build, Firefox Release startup and policy/extension evidence |
| 2 | ChatGPT 1 and ChatGPT 2 visible in desktop UI | NOT_RUN | Deployed command responses plus actual Firefox UI screenshot |
| 3 | ChatGPT tab opens in named container | NOT_RUN | Deployed tab response and visible color/icon |
| 4 | ChatGPT read/type/send | NOT_RUN | Actual ChatGPT composer, programmatic send and readback; fixture tests cannot substitute |
| 5 | WebSocket reconnect after Coolify app restart | NOT_RUN | Production app restart and successful subsequent command |
| 6 | Two simultaneous isolated placeholder sessions | NOT_RUN | Actual Firefox cookie/localStorage partitioning in the deployed named containers |
| 7 | Browser still returns 302 to Authelia | NOT_RUN | Post-redeployment unauthenticated request and preserved live proxy configuration |
| 8 | Rollback and profile-volume preservation | NOT_RUN | Live mount identity, previous image/settings, usable backup and rollback evidence |

Deployment requires an authenticated management connection, a confirmed secure
secret source and the signed artifact. The current session has not satisfied
those gates. Runtime image build, native Compose secret injection, Firefox
policy installation, real ChatGPT behavior, live TLS routing and volume
persistence are outside the local test evidence.

## Functional limitation

`tabs.eval` accepts packaged read-only probes, not arbitrary JavaScript. This
signing-driven limitation is documented in the README and API definition.
The plain WebSocket stays on the same-host private Docker network; remote agent
traffic uses HTTPS. Both details are disclosed to AMO for review rather than
represented as already approved.
