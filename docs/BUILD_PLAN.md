# Kasm Firefox container driver

## Scope and acceptance (original production design)

Build one persistent Manifest V2 extension, one internal HTTP/WebSocket driver,
one custom Firefox image, and one Docker Compose application. Preserve the
existing Kasm home volume, port 6901, browser domain, Authelia middleware,
header-injection middleware and disabled gzip setting. Use contextual identities
in the existing Firefox process. No profile creation, CDP, login automation,
unsigned release install, or public WebSocket/automation port.

The deployment acceptance record must separately cover: policy install on first
boot; two named containers visible; ChatGPT tab with container marker; read/type
and programmatic send; reconnect after app restart; placeholder-session isolation;
unauthenticated browser redirect to Authelia; recoverable previous deployment and
unchanged volume. Local tests do not satisfy these live gates.

## Components and fixed contract

- `extension/`: privileged background routing, fixed packaged DOM operations,
  managed configuration, bounded reconnect. Extension ID `kasm-agent@chabad.gr`.
- `extension/protocol.js`: canonical shared command constants and validation,
  consumed directly by the driver and loaded by the extension.
- `driver/`: Node HTTP + maintained `ws` library, API key, shared-token WebSocket,
  correlation, expiration, bounded queues, no automatic mutation retry.
- `firefox/`: unmodified Kasm startup inherited from the pinned base image;
  policy install from a local AMO-signed XPI.
- `scripts/`: deterministic packaging, signing, artifact verification, deployment
  preflight and live verification helpers. No secrets in source or artifacts.

Request: `{id,cmd,container,deadline,...}`. Reply:
`{id,ok:true,result}` or `{id,ok:false,error:{code,message}}`.
`deadline` is supplied by the driver (epoch milliseconds).
All `tabs.*` commands require an exact container name and explicit tab ID except
create/list. URL permission is restricted to `https://chatgpt.com/*` and the
private `http://driver:8080/*` origin. A tab's current container and URL are
checked again before each DOM operation.

The API prefix is `/agent-driver/v1`; WebSocket is `/ws` on private port 8080.
Only the API prefix may be routed by Traefik. The browser root remains behind
Authelia. The API additionally requires a distinct long random `X-API-Key`.

## Signing constraint

Mozilla's Add-on Policies prohibit executing remotely supplied code. `tabs.eval`
therefore exposes only packaged read-only probes (`page`, `elements`, `storage`)
and rejects arbitrary code with `REMOTE_CODE_FORBIDDEN`. This is a deliberate
limitation against an unrestricted JavaScript evaluator; it is not represented
as arbitrary JS support. AMO acceptance and review remain external gates.

## Secret provisioning

One native managed-storage JSON secret, `DRIVER_MANAGED_STORAGE`, contains
`name`, `description`, `type: storage`, and `data: {wsUrl,wsToken}`. Mount the
same Compose secret in Firefox at its native managed-storage path and in the
driver under `/run/secrets/`. The second secret, `DRIVER_API_KEY`, is mounted
only in the driver. Both originate in the secure vault. AMO credentials are
signing-only secrets and never enter runtime images or the extension.

## State transitions and writers

| Machine | States | Allowed transitions | Single writer | Terminal/side effects |
| --- | --- | --- | --- | --- |
| Extension connection | initializing, connecting, connected, waiting, blocked, stopped | initializing→connecting/blocked/stopped; connecting→connected/waiting/stopped; connected→waiting/stopped; waiting→connecting/stopped | transition | blocked/stopped are terminal; waiting schedules one capped jittered retry |
| Driver connection | disconnected, handshaking, ready | disconnected→handshaking; handshaking→ready; either active state→disconnected | transitionBridge | disconnect fails pending requests; duplicate peer refused |
| Command | pending, succeeded, failed, timed_out | pending→succeeded/failed/timed_out | finish helper | all final states clear timer and remove pending; completed IDs retained briefly to prevent replay |

## Delivery sequence

1. Inspect baseline and upstream; record source selection and API contract.
2. Implement extension, driver, native policy image, secret mounts and tests.
3. Run real local HTTP/WebSocket tests, DOM tests, extension lint and XPI build.
4. Commit reviewable branch and open one implementation PR; do not merge.
5. Request AMO signing credentials through an available secure input channel only
   after the unsigned XPI is ready; obtain signed XPI and verify its identity.
6. Read live Coolify configuration, verify access and exact existing volume name,
   snapshot rollback metadata, build image, deploy via API, run all live gates.

## Build status — isolated release 0.1.3 (2026-11-27)

The original design and delivery sequence above are historical; they do not authorize actions on the production stack. Signed 0.1.3 source/package verification, the isolated signed Firefox fixture and all 73 automated tests passed. The isolated integration branch is `test/release-0.1.2-coolify-acceptance` (historical branch name). The acceptance documentation is under review in draft PR #12 against that branch alone. See [Release acceptance evidence](RELEASE-ACCEPTANCE-EVIDENCE.md) and [test traceability](RELEASE-TEST-TRACEABILITY.md). The source-defined separate isolated profile is not a change to the original production profile.

The authenticated isolated driver gate is closed; the eight deployed acceptance criteria and actual ChatGPT control tests remain NOT RUN. Signed Release restart is now proven on a disposable CI fixture in [draft PR #15](https://github.com/Neup123/kasm-chrome/pull/15) ([signed Release restart fixture job 140511960304](https://github.com/Neup123/kasm-chrome/actions/runs/46000898359/job/140511960304)); deployed restart/rollback are not established by either Release or ESR fixture tests. Do not retry the channel, request credentials, merge or deploy. Private snapshots, credentials and real records do not belong in repository evidence.

## Evidence boundaries

Local tests cover API auth, WebSocket protocol, timeouts, reconnect logic,
container dispatch, DOM operations and packaging. They cannot prove Firefox
Release signature acceptance, Kasm first boot, production ChatGPT behavior,
Traefik/Authelia settings, live volume persistence or rollback.
