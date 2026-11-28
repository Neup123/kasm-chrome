# Verification record

## Current release evidence (2026-11-27)

The isolated integration branch `test/release-0.1.2-coolify-acceptance` contains signed 0.1.3, despite its historical name. See [current evidence and exact provenance](RELEASE-ACCEPTANCE-EVIDENCE.md) and [isolated stack scope](RELEASE-ACCEPTANCE.md). The historical 0.1.0 record below is retained for traceability, not current release status.

| # | Original acceptance criterion | Verified CI evidence | Deployed acceptance status and missing receipt |
| --- | --- | --- | --- |
| 1 | Policy installation | Stock Firefox Release 160.0.1, active signed 0.1.3 (signedState 2); ready bridge ([gateway/fixture CI](https://github.com/Neup123/kasm-chrome/actions/runs/45971188640/job/140411752357), [repeat signed restart/restore CI](https://github.com/Neup123/kasm-chrome/actions/runs/46006819682/job/140531948215)) | NOT RUN — actual installed version, signature state and ready bridge |
| 2 | Two named containers visible in desktop UI | Distinct named contextual identities via API, same identities after restarts/restore ([repeat signed restart/restore CI](https://github.com/Neup123/kasm-chrome/actions/runs/46006819682/job/140531948215)); desktop presentation not tested | NOT RUN — desktop visibility and color/icon |
| 3 | ChatGPT tab in named context | Fresh named acceptance tab, fixture=true in bootstrap log ([gateway/fixture CI](https://github.com/Neup123/kasm-chrome/actions/runs/45971188640/job/140411752357)); two internal fixture contexts in [repeat signed restart/restore CI](https://github.com/Neup123/kasm-chrome/actions/runs/46006819682/job/140531948215) | NOT RUN — actual ChatGPT tab and container marker |
| 4 | Read/type/send | Internal fixture type, click and readback plus Escape and cross-context rejection ([repeat signed restart/restore CI](https://github.com/Neup123/kasm-chrome/actions/runs/46006819682/job/140531948215)); synthetic DOM tests for real-UI control logic | NOT RUN — authenticated composer and observable real conversation result |
| 5 | Reconnect after restart | Changed disposable driver/browser start timestamps; ready bridge and unchanged named identities after both restarts ([repeat signed restart/restore CI](https://github.com/Neup123/kasm-chrome/actions/runs/46006819682/job/140531948215)) | NOT RUN — deployed app restart and subsequent authorized command |
| 6 | Independent sessions | Two fixture contexts with independent cookie/localStorage markers; both recovered without reseeding after restarts and restore ([repeat signed restart/restore CI](https://github.com/Neup123/kasm-chrome/actions/runs/46006819682/job/140531948215)) | NOT RUN — two actual deployed test contexts and readback |
| 7 | Proxy authentication | Internal HTTP gateway port 8081: unauthenticated root, API base and status return 401; authenticated status version 0.1.3 and ready bridge ([gateway/fixture CI](https://github.com/Neup123/kasm-chrome/actions/runs/45971188640/job/140411752357)) | NOT RUN — external TLS/port 1004 and actual authorized browser/driver routing; original production Authelia 302 requirement outside isolated scope |
| 8 | Rollback and volume preservation | Source-scoped topology ([gateway/fixture CI](https://github.com/Neup123/kasm-chrome/actions/runs/45971188640/job/140411752357)); unchanged CI volume through restart; stopped profile archive, checksum, distinct restored volume, same-image recreation and persistent markers ([repeat signed restart/restore CI](https://github.com/Neup123/kasm-chrome/actions/runs/46006819682/job/140531948215)) | NOT RUN — actual deployed mount identity, private backup restore, prior image/configuration rollback, post-rollback health; no image-version rollback tested |

All eight deployed acceptance criteria remain NOT RUN (0/8 verified). This is a distinction between the strength of the CI evidence and the absence of the required deployed receipts, not an assertion that the deployed application failed. The original production criteria are retained historically, and production is outside the current scope. The completed deployment receipt and independent repository-level promotion #14 do not certify runtime health. The actual ChatGPT control tests remain NOT RUN; the authenticated channel is closed, no new probe or deployment is authorized.

### Final documentation-commit verification

- [repeat signed restart/restore CI](https://github.com/Neup123/kasm-chrome/actions/runs/46006819682/job/140531948215): PASS on `a398d56564f22f55ced6322b2956c24bbd305c47`, reproducing both restarts and backup restoration in stock signed Firefox Release; log readback through 13:25:44 UTC.
- [test draft validation](https://github.com/Neup123/kasm-chrome/actions/runs/46006819676/job/140531948357): PASS on the same commit, 73/73 tests, zero failed/skipped; zero extension lint errors/warnings; API docs, Compose source controls and unsigned package verification.
- [documentation draft validation](https://github.com/Neup123/kasm-chrome/actions/runs/46006860933/job/140532086072): PASS on `4caef384da8de71988ab22c27b936b8b3f47fb64`, same 73/73 tests and full validation.
- The gateway evidence is specifically internal HTTP on port 8081; it does not demonstrate external HTTPS, a successful authorized KasmVNC GUI session, or port 80 live reachability. CI bootstraps the fixture URL rather than ChatGPT. These are limitations, not missing source-documentation entries.

The completed evidence closes the repository/CI reconciliation item, not the live acceptance gate.

## Candidate 0.1.4 — outstanding acceptance register (2026-11-27)

[Draft PR #16](https://github.com/Neup123/kasm-chrome/pull/16) remains separate from the signed 0.1.3 integration branch and from draft #15's signed-runtime fixture. The [candidate evidence record](https://github.com/Neup123/kasm-chrome/blob/21e645ba399937c92380c454e459e330a571c58b/docs/FRESH-COMPOSER-EFFORT-EVIDENCE.md) contains the red/green identification tests, stale-package rejection receipts and independent archive inspection. Its [unsigned artifact 15206871717](https://github.com/Neup123/kasm-chrome/actions/runs/46018215466/artifacts/15206871717) is recorded as source-matching for all seven files and unsigned. The latest [candidate validation 46023497091](https://github.com/Neup123/kasm-chrome/actions/runs/46023497091/job/140588835502) completed successfully on `21e645ba399937c92380c454e459e330a571c58b`: 79/79 tests, zero failed/skipped; zero extension lint errors/warnings; API docs, Compose source controls and unsigned package verification. The job reports version 0.1.4, source_files_match=true and signature_entries_present=false. The archived package receipt is prior recorded evidence; this reconciliation rechecked the repository and final CI logs, not the archive bytes again. Candidate extension tree `cdfa6f1c9ee0cfec7846e1a909f1e1c9a9f4bd29` differs from the signed 0.1.3 integration tree `6e2ab512e420e8849832cc279171ee8c4d37ab1e`. Signed XPI and signed metadata blob identities are unchanged; there is no matching signed 0.1.4 package in the candidate draft.


### Candidate identity and combined synthetic evidence

The original PR #16 receipt above applies to its exact source only. The later separate PR #17 and combined PR #18 are now accounted for in this register; they do not supersede the deployed signed 0.1.3 evidence. Repository tree and final CI log checks establish the following review identities:

| Review candidate | Exact draft head | Extension Git tree | Verified scope |
| --- | --- | --- | --- |
| [PR #16 evidence](https://github.com/Neup123/kasm-chrome/blob/21e645ba399937c92380c454e459e330a571c58b/docs/FRESH-COMPOSER-EFFORT-EVIDENCE.md) | `21e645ba399937c92380c454e459e330a571c58b` | `cdfa6f1c9ee0cfec7846e1a909f1e1c9a9f4bd29` | 79/79; prior independently recorded unsigned archive inspection |
| [PR #17 evidence](https://github.com/Neup123/kasm-chrome/blob/0175db13d0f98837e2b49b78e548db046679c376/docs/FIVE-TICK-EFFORT-EVIDENCE.md) | `0175db13d0f98837e2b49b78e548db046679c376` | `90a8009ed92d21731b2b266ecb74a7cf8947f8d1` | 79/79, [five-tick final CI](https://github.com/Neup123/kasm-chrome/actions/runs/46043162623/job/140655723185); unsigned CI package |
| [PR #18 evidence](https://github.com/Neup123/kasm-chrome/blob/436cbd8b3dc16aa3b1b1791cec8e78992a549e91/docs/COMBINED-EFFORT-EVIDENCE.md) | `436cbd8b3dc16aa3b1b1791cec8e78992a549e91` | `4787ac9197c370e622eca1c138fad3a80fd0881f` | 91/91, [combined final CI](https://github.com/Neup123/kasm-chrome/actions/runs/46059206124/job/140709069811); unsigned CI package |

All three PRs remain independent drafts targeting `test/release-0.1.2-coolify-acceptance`. Their identical manifest Git blob `bac18e5a82a93f3319149947ba00f8d57c015320` gives the same provisional version 0.1.4 but does not identify a unique source or release. The signed 0.1.3 XPI and metadata, driver tree and protocol blob are identical across the integration baseline and all three drafts. Exact retained blobs: XPI `3de4aef1611c8e7e6de2054d75929f99e2b0fe7b`, metadata `f01597d36de048cf9661deebccdb5a7e897bf00c`, driver tree `1918ce8395a8f8209264460da64aa5a92c11d68d`, protocol `d149897d904ce57eb9f7cedc1b6ebe429de319d1`. No new candidate signature is present.

The final combined CI job independently rechecked in this documentation turn reports 91/91 tests, zero failed/skipped and zero lint errors/warnings, source_files_match=true, signature_entries_present=false. The unsigned XPI SHA-256 from that job is `164ccc40613581f9dd2c2facc18886e1f1f4c5c484d08ae07a2ea857f7dc9252`; the earlier implementation job's distinct hash is a receipt of that build only. This is a CI-log receipt, not an independent download or archive inspection for #18. Likewise the final #17 job reports unsigned source equality, SHA-256 `bf12cbf7328989dd133e3fafcd178d9642c778ead1cef667837f152ec0ee189b`; its archive was not independently downloaded in this reconciliation.

The six joint tests exercise two sibling-toolbar layouts with a complete five-tick row, rejection of a partial-only track, unsupported current and final labels, and ambiguous duplicate trigger rejection. They prove those synthetic behaviors, not actual five-level markup, label names/order, or real High selection. PR #18 is the combined review unit; no merge or promotion is implied. The two individual drafts remain independently identifiable. No acceptance result transfers between these three source trees merely because they share a manifest version.

| Outstanding gate | Current disposition | Missing evidence |
| --- | --- | --- |
| Candidate source and unsigned package | PASS, repository/CI and independent archive-byte scope for #16, #17, #18 and #19 | All four source-specific archive receipts recorded; no claim of signature trust |
| Protected signing and release identity | BLOCKED / NOT RUN for 0.1.4 | Source-matching signed artifact, artifact hash and version, protected signing receipt and verified package identity |
| Signed candidate Firefox runtime | NOT RUN for 0.1.4 | Stock Release policy installation, active signed version, ready bridge, internal fixture behavior, restart and restore results for the changed source; 0.1.3 results are historical comparison only |
| Fresh-conversation effort trigger and five-tick layout | NOT RUN live | Independently observed actual composer, unique associated trigger, complete label row/track, current label, and exact outcome/error; synthetic layouts are not live markup |
| Effort mutation and readback | NOT RUN live | Actual authorized High selection and independent readback; synthetic fixture success is not a real result |
| Other real controls | NOT RUN live | Control-specific receipts for approval, keyboard, inspect/click coordinates and interactive mapping on the authorized test context |
| Deployed acceptance | 0/8 verified; NOT RUN | All eight deployed receipts specified in the signed 0.1.3 matrix above; candidate-specific results required for any later 0.1.4 acceptance claim |
| Image-version rollback | NOT RUN | Evidence of actual prior-image/configuration rollback, preserved mount and restored functionality; same-image disposable recovery is insufficient |

The scope and authority gates remain unchanged. The signing and deployed steps above are missing evidence, not authorization or instructions to execute them. Do not retry the closed authenticated channel or substitute an alternate path. No signing, deployment, merge or real account interaction is part of this reconciliation. All remaining gaps are explicitly classified and linked for the three source-specific candidates; this closes the documentation reconciliation, not the release or live acceptance gates. Do not create another evidence-only task unless genuinely new repository evidence or a separately authorized criterion emerges.


### Independent archive-byte closure for PRs #17 and #18 (2026-11-27)

The previous CI-only gap in this register is now closed. Downloaded the two exact published artifacts and independently verified local ZIP/XPI bytes, CRC, exact entry inventory and all seven Git blob identities against the tested source trees.

| Draft and tested source | Artifact | ZIP SHA-256 | XPI SHA-256 | Result |
| --- | --- | --- | --- | --- |
| #17 `0175db13d0f98837e2b49b78e548db046679c376` | [15220692775](https://github.com/Neup123/kasm-chrome/actions/runs/46043162623/artifacts/15220692775) | `556fc62d01b05557394dd70ad6167af76e1952f6b8db643dc8077f1ee872d357` | `bf12cbf7328989dd133e3fafcd178d9642c778ead1cef667837f152ec0ee189b` | 7/7 blobs match; unsigned |
| #18 `436cbd8b3dc16aa3b1b1791cec8e78992a549e91` | [15227822107](https://github.com/Neup123/kasm-chrome/actions/runs/46059206124/artifacts/15227822107) | `cbdb54c42daa18daabc7b2a7a871dec242f283ba66c0fb1001dd5217f8267c34` | `164ccc40613581f9dd2c2facc18886e1f1f4c5c484d08ae07a2ea857f7dc9252` | 7/7 blobs match; unsigned |

Full per-file receipts: [#17](https://github.com/Neup123/kasm-chrome/blob/612939017089170a645bd242e2c49d8b70daa2d5/docs/FIVE-TICK-EFFORT-EVIDENCE.md) and [#18](https://github.com/Neup123/kasm-chrome/blob/90ab79836bd41799f7c79c24082cbf265796f377/docs/COMBINED-EFFORT-EVIDENCE.md). Each outer archive contains exactly one XPI; each XPI contains exactly seven expected files, no duplicate entries or signature files. Both manifests identify version 0.1.4 and extension ID `kasm-agent@chabad.gr`; content.js blob differs as expected between candidates. The earlier #16 archive receipt remains source-specific. These are byte-level provenance checks, not cryptographic signature acceptance, installed runtime or live UI evidence. All three unsigned candidate archive documentation gaps are closed. No remaining distinct offline documentation/evidence task is identified in the current register; signing and live acceptance remain closed. The earlier CI-only statements describe the state before this follow-up.


### Generic-trigger candidate: source and independent archive receipt (2026-11-28 UTC)

[Draft #19](https://github.com/Neup123/kasm-chrome/pull/19) preserves the combined #18 corrections and adds a bounded explicit current-level fallback for a genuinely generic Thinking effort trigger. The original source early abort is reproduced in the red CI (100 total, 93 passed, 7 failed; two new rejection cases already passed). [final candidate CI](https://github.com/Neup123/kasm-chrome/actions/runs/46072542679/job/140752639001) completed at exact head `a7ef3f687f1e8e8788345e6340f77ef935a3ca73`: 100/100 passing, no failure/skip, zero lint errors/warnings, unsigned package source equality. The candidate extension tree `9b7ad80f81dadc2891545e9a7b0dfc72894f3cd8` differs from the earlier three trees. The immutable manifest blob is still `bac18e5a82a93f3319149947ba00f8d57c015320`; the version is provisional 0.1.4, not a unique release identifier. The signed 0.1.3 XPI/metadata and driver/protocol identities remain unchanged.

| Exact artifact | Outer SHA-256 | Inner XPI SHA-256 | Independent result |
| --- | --- | --- | --- |
| [unsigned artifact 15233278554](https://github.com/Neup123/kasm-chrome/actions/runs/46072542679/artifacts/15233278554), 22,678 bytes | `85e46438660d64a182b978b71fffe58f922a8732e13b5412c37e99b8cd02d3bf` | `605bedf4817ffc41fdb7375bc16b2d3316249a8b5f17e9d224a195b933115b13` | CRC and exact inventory pass; 7/7 Git blobs match; no signature entries |

The archive was actually downloaded and checked locally; both SHA-256 hashes match the final job log, outer digest matches GitHub metadata, and the complete seven-file payload matches the immutable tree. See [PR #19 generic-effort evidence](https://github.com/Neup123/kasm-chrome/blob/63d3fbc3f4f5462f70162502533dc719d889da7d/docs/GENERIC-EFFORT-EVIDENCE.md) for per-file receipts. The prior CI-only receipt is historical for a different build of the same tree. #19 is the latest combined review candidate, not a signed or accepted release. Earlier PRs remain independent and unchanged.

**Proven:** the generic trigger fallback can identify a current supported value from an explicitly associated named slider in the constructed three-tick fixtures, and rejects absent, unsupported, ambiguous and unrelated evidence. The 91 prior combined regression tests also pass. The later test-only follow-up establishes generic fallback in constructed five-tick layouts as documented below. **Unproven:** actual fresh-conversation markup/association/current-value metadata, generic fallback in a live five-tick layout, actual High mutation/readback, signed installation, runtime and deployed acceptance. If no explicit supported level is available, the fallback deliberately fails closed. All four candidates now have source-specific unsigned archive receipts. Signing and live gates are unchanged; no operational action is implied.

### Generic-trigger/five-tick joint synthetic closure (2026-11-28 UTC)

PR #19 subsequently passed 108/108 tests, including eight named generic-trigger/five-tick joint tests (eleven fixture executions). The extension source tree is unchanged. See [joint synthetic evidence](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/docs/GENERIC-EFFORT-EVIDENCE.md#combined-generic-trigger-and-five-tick-synthetic-acceptance-2026-11-28-utc) and [joint fixture CI](https://github.com/Neup123/kasm-chrome/actions/runs/46090067012/job/140808667617). The exact tested commit `b24b738299ed98ab01d2bcfc02a082127583ed30` differs from the previous candidate head only in tests/extension-content.test.js; all other 68 Git blobs were compared and are identical. CI logs report 108/108 passing, zero failures/skips and zero lint errors/warnings, unsigned package source equality and no signature entries. The eight joint tests cover supported forward/reverse endpoints, idempotent readback, missing/unsupported values, incomplete or unrelated geometry, interleaved labels, ambiguous sliders and failed final readback. The existing independent archive receipt relates to the unchanged extension tree, not the new build ZIP. Actual UI metadata, live selection/readback, signed installation, runtime and deployed acceptance remain unproven. No signing or runtime action was performed.

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

## Historical live acceptance record (0.1.0; superseded by current matrix above)

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
