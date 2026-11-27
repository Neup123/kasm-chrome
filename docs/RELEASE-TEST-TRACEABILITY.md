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

## Acceptance disposition

All positive synthetic results, negative origin checks, source package verification and previously observed isolated CI results are retained. The complete eight-criterion deployed evidence matrix remains in [Verification record](VERIFICATION.md); release identities and deployment receipt are in [Release acceptance evidence](RELEASE-ACCEPTANCE-EVIDENCE.md). No release is authorized on the basis of this record alone.
