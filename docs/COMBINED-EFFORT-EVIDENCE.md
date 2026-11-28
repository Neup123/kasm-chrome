# Combined effort identification — synthetic acceptance evidence

Scope: independent unsigned draft against the isolated integration branch only. No signing, driver connection, live acceptance, deployment or merge. Existing PRs #16 and #17 remain unchanged.

## Inputs and composition

- Integration baseline `fc1c636410f2bf1b7973ff7d612c77759ed3698b`.
- [Fresh-composer draft #16](https://github.com/Neup123/kasm-chrome/pull/16) at `21e645ba399937c92380c454e459e330a571c58b`.
- [Five-tick draft #17](https://github.com/Neup123/kasm-chrome/pull/17) at `0175db13d0f98837e2b49b78e548db046679c376`.
- Compared each exact head against the baseline. PR #16 changes effortButton; PR #17 changes effortLabel and effortGeometry. Verified the three function sections are disjoint, and composing their exact text in either order produces identical content.js. No unrelated runtime changes.
- Both draft manifests are byte-identical (provisional 0.1.4); signed 0.1.3 artifact and metadata are retained, not candidate artifacts. Both original test suites are preserved; fiveTickHarness accepts optional fixture markup with its original default unchanged. Six additional cases exercise the two fixes together. Existing protocol and dispatch/guard code reused; no additional state machine, dependencies or permissions.
- Separate source evidence from both original PRs is preserved in their respective documents. Their CI receipts do not certify the combined source.

## Expected regression evidence

73 baseline tests + 6 fresh-composer regressions + 6 five-tick regressions + 6 joint cases = 91 tests. Joint fixtures cover form and test-ID sibling toolbars, complete-vs-partial track geometry, unsupported current/final labels and duplicate trigger rejection. All use constructed jsdom markup and geometry; no observed live UI, real record, or account is used. Additional labels are geometry only; Low/Medium/High remains the existing protocol contract.

## Observed combined result — PASS

[Completed validation run 46059098730, job 140708719641](https://github.com/Neup123/kasm-chrome/actions/runs/46059098730/job/140708719641) tested commit [`24d2e59e0525fd2e62eb7e01538aa26397fd7e4b`](https://github.com/Neup123/kasm-chrome/commit/24d2e59e0525fd2e62eb7e01538aa26397fd7e4b). Job logs independently reviewed: 91 tests passed, zero failures or skips; zero extension lint errors/warnings; API docs drift check, Compose source controls, unsigned XPI build, source verification and upload passed.

| Joint synthetic case | Verified outcome |
| --- | --- |
| Fresh form sibling + complete five-tick row and nearer partial track | PASS — full track at x=200, High readback, repeat High idempotent |
| Fresh test-ID sibling + complete five-tick row | PASS — full track at x=200, High readback |
| Fresh sibling + partial-only track | PASS — EFFORT_TRACK_NOT_FOUND, no drag |
| Fresh sibling + current Extra High | PASS — EFFORT_CURRENT_UNKNOWN, no opening or drag |
| Fresh test-ID sibling + final Extra High | PASS — EFFORT_NOT_APPLIED, one drag on full track, no false verification |
| Fresh sibling + duplicate named effort controls | PASS — EFFORT_PICKER_NOT_UNIQUE before opening or dragging |

All 12 previously added regression tests and the original 73 tests passed in the same execution. The combined extension Git tree is `4787ac9197c370e622eca1c138fad3a80fd0881f`, distinct from either individual draft. Unsigned XPI SHA-256 `0416123bc6bff6ac07b59388a066d46e12bb3673faa8b5634b60b4701425555b`, source_files_match=true and signature_entries_present=false (CI receipt, not independent archive download). Compared exact Git blobs: protocol `d149897d904ce57eb9f7cedc1b6ebe429de319d1`, driver tree `1918ce8395a8f8209264460da64aa5a92c11d68d`, retained signed 0.1.3 XPI `3de4aef1611c8e7e6de2054d75929f99e2b0fe7b` and signed metadata `f01597d36de048cf9661deebccdb5a7e897bf00c` are unchanged. The provisional 0.1.4 manifest does not establish a signed release identity.

## Disposition

**Closed:** synthetic regression compatibility of PRs #16 and #17 at the exact reviewed combined source. **Unproven:** any real five-level markup or label layout, live effort trigger, actual High mutation/readback, signed combined XPI or Firefox installation, deployed acceptance and image-version rollback. CI fixtures do not establish live behavior. The old signed artifact is not a matching candidate. No signing, merges, deployments or live connection attempts were made; the authenticated gate stays closed. Individual draft evidence remains historical for its exact source, and neither individual draft has been merged. The combined draft is a review candidate only.

## Independent unsigned archive receipt (2026-11-27)

Downloaded [artifact 15227822107](https://github.com/Neup123/kasm-chrome/actions/runs/46059206124/artifacts/15227822107) from [completed validation job 140709069811](https://github.com/Neup123/kasm-chrome/actions/runs/46059206124/job/140709069811), exact source commit `436cbd8b3dc16aa3b1b1791cec8e78992a549e91` (91/91 passing). Independently inspected local archive bytes using Python zipfile/hashlib; compared hashes with the GitHub artifact metadata, previously reviewed job log and immutable Git tree.

| Check | Observed result |
| --- | --- |
| Outer ZIP size | 21987 bytes |
| Outer SHA-256 | `cbdb54c42daa18daabc7b2a7a871dec242f283ba66c0fb1001dd5217f8267c34` — matches GitHub metadata |
| Outer inventory | Exactly one `kasm-agent-unsigned.xpi`; CRC check passed |
| XPI SHA-256 | `164ccc40613581f9dd2c2facc18886e1f1f4c5c484d08ae07a2ea857f7dc9252` — matches CI log |
| XPI inventory | Exactly seven files, no duplicates or extra entries, CRC check passed |
| Git blob equality | 7/7 match candidate tree `4787ac9197c370e622eca1c138fad3a80fd0881f` |
| Manifest | 0.1.4, ID `kasm-agent@chabad.gr` |
| Signature | Zero signature entries; unsigned |

Git blob hashes calculated from actual XPI payload bytes using SHA-1 over the Git blob header plus file bytes: LICENSE `fb698beea6cd2d6dc5001c794325cde723428230`, background.js `b9031b035e77e1f933d529967b386226b3622ee6`, content.js `746c623af65bfb63891bfc57ec7f95651b8d6a62`, core.js `3a03491644edfb512ff1b3abc4cac6d3a5cdcd4a`, manifest.json `bac18e5a82a93f3319149947ba00f8d57c015320`, protocol.js `d149897d904ce57eb9f7cedc1b6ebe429de319d1`, transport.js `041c5698c039e30d062206308aa7d588c4ee76d5`. All match the repository. The archive hash identifies this particular build, not a reproducible ZIP timestamp contract.

This closes the independent archive-byte evidence gap for PR #18. No installation, signing, cryptographic trust, real ChatGPT interaction or deployed acceptance is proven; the live and signing gates remain closed. The earlier CI-only package statements refer to their original builds and are retained as history.
