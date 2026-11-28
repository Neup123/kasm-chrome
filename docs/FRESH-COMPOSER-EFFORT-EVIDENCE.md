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

## Independently executed stale-package gate (2026-11-27)

Offline check of the actual AMO-signed 0.1.3 XPI, not a fake signature fixture. The retained archive from [signing artifact 15181569855](https://github.com/Neup123/kasm-chrome/actions/runs/45965157214/artifacts/15181569855) matched outer SHA-256 `005ffe16836259ba907966d0f2b77139aa05458a7e30ba2a2fe61b8700323f11`; inner XPI SHA-256 `06daaffce4d70e47568a33bee00c15ab4df5231f754fee0ec9eefbee0deb3d46`. XPI Git blob `3de4aef1611c8e7e6de2054d75929f99e2b0fe7b` and metadata blob `f01597d36de048cf9661deebccdb5a7e897bf00c` match both branches. Reconstructed the seven baseline extension files from the signed payload and reviewed source manifest, applied the exact repository patch to reproduce the seven candidate files, and checked every file's Git blob against each immutable tree (7/7 both). The unchanged [verifier](https://github.com/Neup123/kasm-chrome/blob/fc1c636410f2bf1b7973ff7d612c77759ed3698b/scripts/verify-xpi.py) was also byte-verified against blob `0df07b7cfb9f345e25401db66503e8d42d1f0668`.

Ran the repository verifier with the actual XPI, `--require-signature --metadata signed-artifact.json` and each source directory:

| Source supplied to verifier | Exit | Actual result |
| --- | ---: | --- |
| Exact signed 0.1.3 integration source `fc1c636410f2bf1b7973ff7d612c77759ed3698b` | 0 | version 0.1.3; source_files_match=true; signature_entries_present=true; cryptographic_trust_verified=false |
| Exact unsigned 0.1.4 draft source `21e146dcf2b3a7e6bfbf3a15d0c0b6f1a398fcb6` | 1 | Artifact verification failed: Signed manifest semantics differ from the reviewed source. |
| Controlled variant: baseline with only the candidate manifest | 1 | Artifact verification failed: Signed manifest semantics differ from the reviewed source. |
| Controlled variant: baseline with only the candidate content.js | 1 | Artifact verification failed: XPI payload differs from the reviewed source. |

The two controlled variants establish that either change independently blocks reuse of the old signed XPI; relabeling its version/metadata cannot make its executable content match. These are isolated offline source comparisons, not installation or runtime tests. The verifier's explicit cryptographic-trust=false result is expected; earlier signed Firefox 0.1.3 CI remains the actual signature acceptance evidence for that version alone. No new signed 0.1.4 artifact, signed image build, real ChatGPT interaction or deployed acceptance is proven. The authenticated channel stays closed; no signing or deployment was attempted.

## Independent unsigned candidate artifact receipt (2026-11-27)

[Validation job 140570739023](https://github.com/Neup123/kasm-chrome/actions/runs/46018215466/job/140570739023) on commit `55c10ff32c1bebb2d556b389937129971d1cee0b` completed with 79/79 passing, no failures or skips. Downloaded [artifact 15206871717](https://github.com/Neup123/kasm-chrome/actions/runs/46018215466/artifacts/15206871717) via the repository connector and independently inspected its local bytes, rather than relying solely on the CI report.

| Check | Independently observed result |
| --- | --- |
| Outer ZIP size | 21,476 bytes |
| Outer SHA-256 | `482ab4ec40cf721663855cf2d475fc82bac6599cbc0dd371310f846759d5bfa6`, matches artifact metadata and job log |
| ZIP contents | Exactly one `kasm-agent-unsigned.xpi` |
| Inner XPI SHA-256 | `0f287c3f5c2eb011152a1691579a2167b906c2006570f04000091b901f0ad1bd`, matches job log |
| XPI payload | Exact seven expected files, no duplicate entries; every Git blob hash matches the immutable candidate tree `cdfa6f1c9ee0cfec7846e1a909f1e1c9a9f4bd29` |
| Manifest | Version 0.1.4; ID `kasm-agent@chabad.gr`; independent manifest semantic comparison with 0.1.3 confirms version-only change |
| Signature | No META-INF signature entries; unsigned |

The seven matched blobs are LICENSE `fb698beea6cd2d6dc5001c794325cde723428230`, background.js `b9031b035e77e1f933d529967b386226b3622ee6`, content.js `c4e3c1ffbc384c31bf51187b61232a6437c39ef4`, core.js `3a03491644edfb512ff1b3abc4cac6d3a5cdcd4a`, manifest.json `bac18e5a82a93f3319149947ba00f8d57c015320`, protocol.js `d149897d904ce57eb9f7cedc1b6ebe429de319d1`, and transport.js `041c5698c039e30d062206308aa7d588c4ee76d5`. The archive hashes identify this particular CI build; different ZIP timestamps can change a rebuild's archive hash without changing the source.

**Closed:** independent unsigned-package provenance for PR #16. **Not proven:** AMO signing of 0.1.4, Firefox Release installation of that signed candidate, real fresh-conversation effort identification/High readback, or deployed acceptance. The earlier 0.1.3 signed CI evidence does not transfer to the changed source. No signed release was produced or promoted; the gate stays closed. No more evidence-only work is implied by these live-only gaps.
