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

Combined CI: pending verification.
