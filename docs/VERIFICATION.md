# Verification record

Date: 2026-11-22. Release: 0.1.0.

**Source and local behavior are tested. The extension is unsigned. No production
deployment or live acceptance is claimed.**

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
