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

Green CI: pending verification.
