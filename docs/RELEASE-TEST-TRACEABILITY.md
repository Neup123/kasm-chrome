# 0.1.3 acceptance traceability — 2026-11-27

This record covers repository/CI evidence only. The authenticated isolated driver gate stays closed. No live operations, credential access, new deployments, or production checks are part of this record.

## Exact test inventory and provenance

The immutable reviewed source is [`fc1c636410f2bf1b7973ff7d612c77759ed3698b`](https://github.com/Neup123/kasm-chrome/commit/fc1c636410f2bf1b7973ff7d612c77759ed3698b). The documentation-only follow-up commit `33afa3bd59d48b641de678fa1ca71d21053ddc66` ran [validation job 140477669326](https://github.com/Neup123/kasm-chrome/actions/runs/45990752186/job/140477669326). Every named test declaration in the six source test files was matched against a successful test name in the CI log. The 73 names match one-to-one; no unmatched, failed, or skipped tests.

| Source file | Declared | Matching successful CI tests | Scope |
| --- | ---: | ---: | --- |
| [artifact.test.js](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/artifact.test.js) | 2 | 2 | Source identity, tampering, unsigned package rejection, secure signing prerequisite |
| [driver.test.js](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/driver.test.js) | 18 | 18 | Local HTTP/WebSocket, authorization, deadlines, disconnect, replay, audit redaction, command transport |
| [extension-content.test.js](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js) | 24 | 24 | Synthetic DOM and document guards; scoped effort, approval, keyboard and coordinate interactions |
| [extension-core.test.js](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-core.test.js) | 11 | 11 | Mocked browser identities, tab/document routing, race guards |
| [extension-transport.test.js](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-transport.test.js) | 12 | 12 | Mocked transport, bounded retries, stale sockets, timer receiver, startup failures |
| [protocol.test.js](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/protocol.test.js) | 6 | 6 | Shared command validation, origin allowlist, bounded key/coordinate inputs |
| Total | 73 | 73 | Automated test suite, not deployed acceptance |

## Specific controls and evidence strength

| Control | Positive synthetic evidence | Negative/guard evidence | Signed Firefox fixture evidence | Actual ChatGPT |
| --- | --- | --- | --- | --- |
| tabs.setEffort | [extension-content.test.js L218-L251](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js#L218-L251): picker, role-less drag and readback; accessible composer | [extension-content.test.js L252-L275](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js#L252-L275): ambiguity/hidden anchors; origin guard | Rejected on internal fixture (URL_FORBIDDEN) | NOT RUN |
| tabs.approve | [extension-content.test.js L191-L202](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js#L191-L202): inspection and exact full-conversation grant; [extension-content.test.js L312-L317](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js#L312-L317): pointerdown and focus trap | [extension-content.test.js L203-L207](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js#L203-L207): wrong second option rejected | Rejected on internal fixture (URL_FORBIDDEN) | NOT RUN |
| tabs.key | [extension-content.test.js L208-L217](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js#L208-L217): bounded key events and focus | Credential exclusion, bounded protocol inputs | Escape event observed by internal fixture | NOT RUN |
| tabs.inspectAt / tabs.clickAt | [extension-content.test.js L276-L291](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js#L276-L291): hit and ancestor geometry, off-center events | [extension-content.test.js L292-L311](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js#L292-L311): changed/covered/uninspected targets, credentials, origin | Rejected on internal fixture (URL_FORBIDDEN) | NOT RUN |
| tabs.mapInteractive | [extension-content.test.js L318](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-content.test.js#L318): role-less affordances and implicit roles | Hidden/offscreen and credential exclusions | Rejected on internal fixture (URL_FORBIDDEN) | NOT RUN |

The shared transport and explicit container/document routing are covered by [driver.test.js L354-L366](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/driver.test.js#L354-L366), [extension-core.test.js L144-L156](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/extension-core.test.js#L144-L156) and [protocol.test.js L32-L44](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/protocol.test.js#L32-L44). These are not positive live UI results. The actual signed Firefox fixture results were checked in [job 140411752357](https://github.com/Neup123/kasm-chrome/actions/runs/45971188640/job/140411752357) and [job 140459592084](https://github.com/Neup123/kasm-chrome/actions/runs/45985396758/job/140459592084).

## Restart, persistence and recovery evidence boundary

The signed Release branch of [run-esr-smoke.sh L58-L77](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/scripts/run-esr-smoke.sh#L58-L77) executes the fixture and verifies Firefox reports the signed extension active; it then exits before the restart sequence. The driver restart, Firefox restart and post-restart persistence readback at [run-esr-smoke.sh L81-L109](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/scripts/run-esr-smoke.sh#L81-L109) belong to the separate ESR path. Earlier ESR restart evidence cannot be transferred to signed Release 0.1.3. The local driver disconnect and replacement tests and mocked transport reconnect tests prove their respective logic only.

The isolated Compose CI validates application-scoped topology and the signed Release fixture demonstrates independent cookie/localStorage contexts before restart. None proves persistence after restarting the signed Release deployment, actual runtime mount identity, backup recovery, or rollback. The original deployed restart/persistence and rollback criteria remain NOT RUN.


### Follow-up: signed Release restart fixture (2026-11-27)

[draft PR #15](https://github.com/Neup123/kasm-chrome/pull/15) adds a separate opt-in CI-only restart path; [signed Release restart fixture job 140511960304](https://github.com/Neup123/kasm-chrome/actions/runs/46000898359/job/140511960304) passed on commit `ab9a59251e71b1da0186e7caa44b9c1475306f0c`. With the exact signed 0.1.3 artifact in Firefox Release 160.0.1, the disposable driver and browser both restarted, the bridge reconnected, the same named contexts and independent cookie/localStorage markers were read back without reseeding, the CI profile volume identity remained unchanged, and the extension remained active with signedState 2 after browser restart. The original smoke result above remains historical and unchanged. This closes the signed Release **CI fixture** restart evidence gap only; deployed stack restart/persistence, runtime mount, backup, rollback and real ChatGPT controls remain NOT RUN. The authenticated channel remains closed.

## Acceptance disposition

All positive synthetic results, negative origin checks, source package verification and previously observed isolated CI results are retained. The complete eight-criterion deployed evidence matrix remains in [Verification record](VERIFICATION.md); release identities and deployment receipt are in [Release acceptance evidence](RELEASE-ACCEPTANCE-EVIDENCE.md). No release is authorized on the basis of this record alone.

## Disposable profile recovery follow-up (2026-11-27)

[signed backup/restore fixture job 140520386269](https://github.com/Neup123/kasm-chrome/actions/runs/46003376739/job/140520386269) passed in [draft PR #15](https://github.com/Neup123/kasm-chrome/pull/15) at tested commit `48182d3a5799cc94f508207838a8ec484fb0c9fd`. The stopped synthetic profile was archived from a read-only volume, checksum verified, restored to a separate empty volume, and opened in a newly created Firefox Release 160.0.1 container using the same image. Both named identities and independent cookie/localStorage markers survived without reseeding; signed extension 0.1.3 remained active (signedState 2). The original disposable volume was retained during the test. This proves same-image synthetic backup recovery only, not a deployed backup/restore, image-version rollback, real profile preservation, live TLS/proxy or real ChatGPT controls. The deployed acceptance criterion remains NOT RUN and the authenticated channel remains closed.

## Unsigned 0.1.4 combined candidate traceability (2026-11-28 UTC)

The 0.1.3 inventory above is historical and remains unchanged. This follow-up independently reads the six immutable source test files at [PR #19 head `fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d`](https://github.com/Neup123/kasm-chrome/commit/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d) and the actual completed [final candidate job 140808996419](https://github.com/Neup123/kasm-chrome/actions/runs/46090173037/job/140808996419) log. Extracted the literal named `test('…', ...)` declarations and successful Node test-reporter lines; compared their exact names as sets, checked counts and uniqueness, and compared the names with the original 0.1.3 baseline. All 108 source names match all 108 successful CI names one-to-one. Zero missing, extra, duplicate, failed or skipped tests. All 73 baseline test names remain present; 35 additional declarations are in extension-content.test.js. This checks execution-name traceability, not exhaustive code coverage or correctness of every assertion.

| Source file | Baseline declarations | Candidate declarations | Matched successful CI names |
| --- | ---: | ---: | ---: |
| [artifact.test.js](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/artifact.test.js) | 2 | 2 | 2 |
| [driver.test.js](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/driver.test.js) | 18 | 18 | 18 |
| [extension-content.test.js](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js) | 24 | 59 | 59 |
| [extension-core.test.js](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-core.test.js) | 11 | 11 | 11 |
| [extension-transport.test.js](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-transport.test.js) | 12 | 12 | 12 |
| [protocol.test.js](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/protocol.test.js) | 6 | 6 | 6 |
| Total | 73 | 108 | 108 |

The additional declarations, with exact source links and successful log names, are below. The five groups correspond to the earlier draft evidence. The latest eight tests execute eleven constructed fixtures; each named declaration is counted once.

### Fresh-composer sibling lookup (#16) — 6/6

| Exact CI test name | Immutable source declaration | Result |
| --- | --- | --- |
| fresh composer with an editor form and sibling named effort control verifies High | [L343](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L343) | PASS |
| fresh explicit composer test ID with sibling named effort control verifies High | [L353](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L353) | PASS |
| fresh explicit composer fallback rejects a bare level label | [L361](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L361) | PASS |
| fresh explicit composer fallback rejects multiple named effort controls | [L368](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L368) | PASS |
| fresh explicit composer fallback never crosses a main landmark or another editor | [L375](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L375) | PASS |
| fresh explicit composer fallback rejects controls in another form or dialog | [L386](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L386) | PASS |

### Five-tick geometry and exact labels (#17) — 6/6

| Exact CI test name | Immutable source declaration | Result |
| --- | --- | --- |
| five-tick effort identifies the full track and exact High tick instead of the nearer partial track | [L424](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L424) | PASS |
| five-tick effort rejects a partial track when no track spans the whole row | [L434](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L434) | PASS |
| Extra High is not verified as High and must not trigger a drag | [L441](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L441) | PASS |
| five-tick effort rejects an unsupported level interleaved between supported ticks | [L448](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L448) | PASS |
| five-tick effort rejects duplicate extra tick labels | [L455](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L455) | PASS |
| five-tick effort does not treat Extra High readback as successful High | [L462](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L462) | PASS |

### Combined fresh-composer and five-tick (#18) — 6/6

| Exact CI test name | Immutable source declaration | Result |
| --- | --- | --- |
| combined fresh form sibling and five ticks choose the full track and verify High exactly once | [L473](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L473) | PASS |
| combined fresh test-ID sibling and five ticks choose the full track | [L482](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L482) | PASS |
| combined fresh sibling with only partial five-tick track fails without drag | [L491](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L491) | PASS |
| combined fresh sibling with Extra High current label fails without opening picker | [L498](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L498) | PASS |
| combined fresh sibling five-tick drag rejects Extra High final label | [L505](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L505) | PASS |
| combined fresh sibling with duplicate named controls rejects before picker opens | [L512](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L512) | PASS |

### Generic current-level fallback (#19) — 9/9

| Exact CI test name | Immutable source declaration | Result |
| --- | --- | --- |
| generic Thinking effort identifies current level from associated slider and verifies exact final readback | [L551](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L551) | PASS |
| generic Thinking effort already High is verified without dragging | [L559](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L559) | PASS |
| generic Thinking effort with missing slider value fails without drag | [L566](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L566) | PASS |
| generic Thinking effort rejects unsupported slider value without drag | [L573](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L573) | PASS |
| generic Thinking effort rejects ambiguous associated sliders without drag | [L580](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L580) | PASS |
| generic Thinking effort does not use a preexisting unassociated popup | [L587](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L587) | PASS |
| generic Thinking effort refuses false Extra High slider readback | [L594](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L594) | PASS |
| generic Thinking effort cannot verify a closed popup with unchanged generic trigger | [L601](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L601) | PASS |
| explicit unsupported current label cannot use generic fallback | [L608](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L608) | PASS |

### Generic fallback and five-tick follow-up (#19) — 8/8

| Exact CI test name | Immutable source declaration | Result |
| --- | --- | --- |
| generic five-tick associated slider verifies exact supported endpoints despite a nearer partial track | [L617](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L617) | PASS |
| generic five-tick associated slider uses supported Low endpoint on reverse drag | [L627](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L627) | PASS |
| generic five-tick missing or unsupported current value refuses drag | [L635](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L635) | PASS |
| generic five-tick partial-only associated slider refuses drag | [L644](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L644) | PASS |
| generic five-tick unrelated full-width track cannot substitute for associated slider | [L651](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L651) | PASS |
| generic five-tick interleaved unsupported tick refuses drag | [L658](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L658) | PASS |
| generic five-tick final unsupported value or closed popup cannot verify High | [L665](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L665) | PASS |
| generic five-tick duplicate associated sliders refuse drag | [L674](https://github.com/Neup123/kasm-chrome/blob/fe7ea04ffcac34540157bbe2d4dcd91b5a276b2d/tests/extension-content.test.js#L674) | PASS |

**Scope:** the final CI log reports 108/108, zero failures/skips, zero extension lint errors/warnings and unsigned package source equality. The source extension tree remains `9b7ad80f81dadc2891545e9a7b0dfc72894f3cd8`. As a consistency check in this documentation turn, locally rechecked the previously downloaded #17, #18 and #19 archives using Python zipfile/hashlib: outer and inner SHA-256, CRC, exact entry inventories, manifest version/ID and 7/7 Git blob hashes all match their recorded receipts. This was a recheck of those retained builds, not a download of the newest CI artifact. No new runtime tests were run. The 108 named tests do not establish actual ChatGPT markup, availability of its current-level metadata, actual High readback, signed installation or any of the eight deployed acceptance criteria. No signing, runtime verification, live connection, deployment or merge is authorized by this record.
