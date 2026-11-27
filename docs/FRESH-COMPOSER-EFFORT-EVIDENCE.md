# Fresh-conversation effort identification — candidate 0.1.4

Scope: repository and synthetic DOM CI only. No driver connection, real ChatGPT content, account, deployment, signing or merge. The live acceptance gate stays closed.

## Evidence and defect

- [PR #11](https://github.com/Neup123/kasm-chrome/pull/11) addressed the reported 0.1.2 missing accessible composer anchor. It does not establish a subsequent real fresh-conversation DOM layout.
- In the reviewed signed 0.1.3 source, [content.js L192-L226](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/extension/content.js#L192-L226), an explicit closest form or composer test-ID wrapper causes an unconditional return of the uniqueness check. Zero in-wrapper candidates produces EFFORT_PICKER_NOT_UNIQUE even when the accessible editor's sibling toolbar has a unique explicitly named effort control. The local ancestry fallback only ran without an explicit wrapper.
- No separate observed fresh-conversation markup or error receipt was found in repository issues, PRs or comments. The sibling-toolbar markup is a deliberately constructed regression fixture, not a capture of the live UI.
- [Red regression CI 46010526316, job 140544558746](https://github.com/Neup123/kasm-chrome/actions/runs/46010526316/job/140544558746) on tests-only commit `1e350750ce764b1f336e075b02c75fea13486546`: 79 tests, 76 pass, 3 fail, none skipped. Both form and test-ID sibling positive fixtures returned `EFFORT_PICKER_NOT_UNIQUE`; the other-editor guard expected the more specific `EFFORT_COMPOSER_AMBIGUOUS` but the old code returned the same generic lookup error. The other three added tests passed.

## Fix

Reuse the existing visible composer anchor and bounded ancestry search. Check explicit scope first; if it is empty, inspect at most six local ancestors from the editor, stopping at conversation/landmark boundaries. Outside the explicit scope require a unique explicit effort aria-label, reject other-editor ambiguity, and exclude controls within other forms/composer wrappers/dialogs/landmarks/editor subtrees. An ambiguous explicit scope never falls back. No arbitrary selector, global lookup, new permission, current-level guess, or change to drag/approval/document/coordinate guards. The existing current and final effort labels still have to verify.

## Release status

The candidate manifest is 0.1.4; the old signed 0.1.3 XPI and metadata are retained unchanged, and do not match the candidate source. The signed artifact build gate must reject the mismatch. No new signed candidate or live acceptance is claimed. Do not deploy or merge on the basis of fixture evidence.

## Green regression evidence — PASS

[Completed validation run 46010708287, job 140545175017](https://github.com/Neup123/kasm-chrome/actions/runs/46010708287/job/140545175017) tested commit [`a272deac656c960ff3a94d00e99b4d54e8f08741`](https://github.com/Neup123/kasm-chrome/commit/a272deac656c960ff3a94d00e99b4d54e8f08741). Job logs independently reviewed: 79/79 passed, zero failed/skipped; zero extension lint errors/warnings; API docs drift, Compose checks, unsigned extension build, exact source equality and artifact upload all passed.

| Added regression test | Baseline | Candidate |
| --- | --- | --- |
| Editor form with sibling named effort control, Medium to High and idempotent High readback | FAIL | PASS |
| Composer test-ID with sibling named control, Medium to High | FAIL | PASS |
| Bare level label outside explicit composer | PASS (rejected) | PASS (rejected) |
| Multiple named controls | PASS (rejected) | PASS (rejected) |
| Main landmark / another editor | FAIL (generic error for other editor) | PASS (bounded lookup and specific ambiguity error) |
| Control belonging to another form or dialog | PASS (rejected) | PASS (rejected) |

CI unsigned XPI: version 0.1.4, SHA-256 `960f3aedb9171ba23f28ad5053978e941b92c78be2726e5d935d3d346b960567`, source_files_match=true, signature_entries_present=false. This identifies the particular CI build, not a signed release. The candidate extension tree `cdfa6f1c9ee0cfec7846e1a909f1e1c9a9f4bd29` differs from the signed 0.1.3 tree `6e2ab512e420e8849832cc279171ee8c4d37ab1e`. Both signed XPI and metadata Git blobs are unchanged; manifest semantic comparison confirms version is its only changed field (permissions unchanged). The existing verifier explicitly rejects differing manifest semantics or payload. No new signed candidate build or installation was attempted.

## Live identification evidence boundary

The only repository-grounded live observation relevant to this fix is the historical report in PR #11: a 0.1.2 request returned EFFORT_COMPOSER_NOT_FOUND on a composer with an accessible Ask ChatGPT label and without the old ID/test ID. That report is attributed, not independently reproduced here. It supports the earlier anchor fix, not the newly constructed sibling-toolbar hypothesis. There is no independently verified real fresh-conversation trigger markup, current level, click/drag result, or post-action High readback in this work. The green tests prove the specific synthetic identification defect is fixed, including rejection cases. They do not prove the actual live page has that structure or that 0.1.4 would work there.

Disposition: source-level regression and evidence item complete. Live identification and interaction remain NOT RUN; gate closed. Source-matching signed 0.1.4 artifact absent from this draft. No authorization to sign, deploy, merge or retry live connections.
