# Five-tick effort identification — independent unsigned candidate

Scope: repository and synthetic DOM tests only. No signing, real ChatGPT interaction, live driver connection, deployment or merge. This is a separate draft against the isolated integration branch, not a combination with PR #16. Both drafts use a provisional 0.1.4 manifest; neither is a signed release, and combined source must be reviewed and validated before any future promotion.

## Exact source gap and evidence

- [Baseline content.js L187–190](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/extension/content.js#L187-L190) matches individual words, so Extra High can be incorrectly verified as High, both before and after a drag.
- [Baseline content.js L375–395](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/extension/content.js#L375-L395) identifies three supported tick centers only and ranks tracks spanning that subset. In a constructed five-label layout a nearer partial track can be selected despite not spanning the whole row.
- [Protocol tests](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/tests/protocol.test.js#L32-L36) explicitly reject Pro and Extra High requests. No protocol change is made. Neither additional tick name nor actual live five-level markup was independently established in the inspected repository evidence. Fixture names such as Minimal and Extra High are synthetic, not a live capture.
- [Red CI 46042840663](https://github.com/Neup123/kasm-chrome/actions/runs/46042840663/job/140654644857) at tests-only commit `9aaced8a9263e07bea52e2fbbc6be3ead491c311`: 79 tests, 73 pass, 6 fail, zero skipped. All six added tests reproduced baseline gaps.

## Correction and boundary

Use complete supported labels (optionally with an explicit effort prefix); if visible text and aria-label disagree or an unsupported label is present, do not claim a current/final level. Require a common visible label row of exactly three or five unique leaf labels, positive ordered horizontal geometry, and contiguous Low/Medium/High positions. Require the track to span the full observed row. Use the actual supported tick centers rather than assuming a five-position mapping. Reject interleaved extra ticks, incomplete/partial tracks, duplicate labels, and ambiguous geometry. Other layout structures fail closed; no guessing, no new supported level or permissions, and no new state machine. Reuses the existing popup, geometry ranking, hit tests, document/deadline guards and drag/readback path.

Green CI: pending verification.
