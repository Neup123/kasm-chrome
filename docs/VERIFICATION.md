# Verification record

## Release 0.1.3 candidate (2026-11-27)

The source-matching AMO-signed XPI is staged for review only. The previous
committed 0.1.2 package does not match the 0.1.3 extension source. The promotion
uses the exact existing signed artifact, not a new AMO submission:

- Extension tree: `6e2ab512e420e8849832cc279171ee8c4d37ab1e`.
- XPI SHA-256: `06daaffce4d70e47568a33bee00c15ab4df5231f754fee0ec9eefbee0deb3d46`.
- [Protected signing run 45965157214](https://github.com/Neup123/kasm-chrome/actions/runs/45965157214).
- [Independent signed Firefox Release and isolated fixture CI 45971188640](https://github.com/Neup123/kasm-chrome/actions/runs/45971188640).
- [Isolated acceptance evidence, draft PR #12](https://github.com/Neup123/kasm-chrome/pull/12).

The signed-Release workflow now verifies the committed package against the
checked-out source and metadata, then builds and runs it in disposable CI.
It does not sign, publish, deploy or write to any branch. It is triggered on
package/metadata changes for main-targeted PRs or explicit workflow dispatch.
The historical unsigned validation and ESR tests remain independent.

**Live acceptance remains NOT RUN.** The authenticated isolated driver
channel is closed. The real ChatGPT login/composer, effort, approval, key and
coordinate interaction tests must pass through the approved channel before
any release authorization. Do not retry the blocked operation or bypass the
gate. This candidate is not a deployment or authorization to merge.

## Historical evidence — release 0.1.0

Date: 2026-11-22. Release: 0.1.0.

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
