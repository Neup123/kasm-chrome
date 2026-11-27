# Five-tick effort identification — independent unsigned candidate

Scope: repository and synthetic DOM tests only. No signing, real ChatGPT interaction, live driver connection, deployment or merge. This is a separate draft against the isolated integration branch, not a combination with PR #16. Both drafts use a provisional 0.1.4 manifest; neither is a signed release, and combined source must be reviewed and validated before any future promotion.

## Exact source gap and evidence

- [Baseline content.js L187–190](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/extension/content.js#L187-L190) matches individual words, so Extra High can be incorrectly verified as High, both before and after a drag.
- [Baseline content.js L375–395](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/extension/content.js#L375-L395) identifies three supported tick centers only and ranks tracks spanning that subset. In a constructed five-label layout a nearer partial track can be selected despite not spanning the whole row.
- [Protocol tests](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/protocol.test.js#L32-L36) explicitly reject Pro and Extra High requests. No protocol change is made. Neither additional tick name nor actual live five-level markup was independently established in the inspected repository evidence. Fixture names such as Minimal and Extra High are synthetic, not a live capture.
- [Red CI 46042840663](https://github.com/Neup123/kasm-chrome/actions/runs/46042840663/job/140654644857) at tests-only commit `9aaced8a9263e07bea52e2fbbc6be3ead491c311`: 79 tests, 73 pass, 6 fail, zero skipped. All six added tests reproduced baseline gaps.

## Correction and boundary

Use complete supported labels (optionally with an explicit effort prefix); if visible text and aria-label disagree or an unsupported label is present, do not claim a current/final level. Require a common visible label row of exactly three or five unique leaf labels, positive ordered horizontal geometry, and contiguous Low/Medium/High positions. Require the track to span the full observed row. Use the actual supported tick centers rather than assuming a five-position mapping. Reject interleaved extra ticks, incomplete/partial tracks, duplicate labels, and ambiguous geometry. Other layout structures fail closed; no guessing, no new supported level or permissions, and no new state machine. Reuses the existing popup, geometry ranking, hit tests, document/deadline guards and drag/readback path.

## Red/green result — PASS, 2026-11-27

[Corrected CI job 140655112787](https://github.com/Neup123/kasm-chrome/actions/runs/46042980473/job/140655112787) on exact implementation commit `e270c28dc34899bcebe587f59d1bc31ef9f03ee9` completed successfully. The six added tests all passed, and the original 73 tests remained green (79/79 total; no failures or skips). Lint reported zero errors/warnings; API docs drift, Compose source checks, unsigned extension build, source verification and upload all passed.

| Synthetic case | Baseline observed | Corrected observed |
| --- | --- | --- |
| Complete five-label row with nearer partial track | Releases at x=200 on the wrong partial track | Releases at x=200 on full track; exact High readback and idempotent subsequent call |
| Only partial track | Unexpected success, no error code | EFFORT_TRACK_NOT_FOUND, no drag |
| Current label Extra High | Unexpected success, no error code | EFFORT_CURRENT_UNKNOWN, no picker click or drag |
| Unsupported interleaved tick | Unexpected success, no error code | EFFORT_GEOMETRY_UNVERIFIED, no drag |
| Duplicate extra labels | Unexpected success, no error code | EFFORT_TICKS_NOT_UNIQUE, no drag |
| Final readback Extra High | Incorrect ok=true, effort=High, verified=true | EFFORT_NOT_APPLIED, one synthetic drag, no false verification |

Baseline details are from the [failed regression job](https://github.com/Neup123/kasm-chrome/actions/runs/46042840663/job/140654644857): four negative assertions attempted to read an absent error.code and therefore raised TypeError; this is a test assertion symptom, not a production exception. The first and last cases have explicit mismatched track and false-success receipts in the same log.

Unsigned CI XPI SHA-256 `11b306c6adfe2578c11f8ab8541ed3c29f725fdde1da4065bfab916647853031`; source_files_match=true, signature_entries_present=false (job report, not independent archive download). Candidate extension tree `90a8009ed92d21731b2b266ecb74a7cf8947f8d1`; comparison with integration confirms manifest version is its only semantic change, including unchanged permissions. Signed 0.1.3 XPI blob `3de4aef1611c8e7e6de2054d75929f99e2b0fe7b` and metadata blob `f01597d36de048cf9661deebccdb5a7e897bf00c` are unchanged. The draft's source differs from both signed 0.1.3 and PR #16's unsigned tree; its provisional 0.1.4 version cannot identify a combined release. Any future integration requires source review and validation; no signing or deployment is authorized here.

**Closed:** the reproducible source-level five-tick identification and false-High verification defects for the constructed row layouts. **Unproven:** actual five-level markup, label names/order, trigger and geometry in fresh/live ChatGPT, actual High selection and readback, combined candidate behavior, new signed package, signed Firefox runtime and all deployed acceptance. The stricter common-leaf-row and contiguous-label requirements intentionally fail closed for other structures; no universal live compatibility is claimed. No authenticated channel use, signing, deployment or merge.
