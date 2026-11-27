# Generic Thinking effort identification — synthetic evidence

Scope: repository source and synthetic DOM tests only. No signing, runtime verification, live driver connection, deployment or merge. This draft copies the exact combined #18 review tree (`90ab79836bd41799f7c79c24082cbf265796f377`) into a single-parent branch against the isolated integration baseline `fc1c636410f2bf1b7973ff7d612c77759ed3698b`. Earlier PRs are unchanged. Manifest remains provisional 0.1.4; old signed 0.1.3 artifact is not a candidate signature.

## Exact gap

The user reports a fresh-conversation composer with a generic Thinking effort trigger and no identifiable level. In [the combined source](https://github.com/Neup123/kasm-chrome/blob/90ab79836bd41799f7c79c24082cbf265796f377/extension/content.js), effortLabel returns null for the generic label, and setEffort throws EFFORT_CURRENT_UNKNOWN before opening the picker. This is separate from finding the trigger and the five-tick geometry work. No live markup or slider value metadata was independently observed; the explicit aria-controls / aria-valuetext structure is a constructed fixture, not a claim about the deployed UI.

[Red validation](https://github.com/Neup123/kasm-chrome/actions/runs/46072298472/job/140751855322) on tests-only relative-to-#18 commit `9a3fef280d01eb99cfb0cf216c728db34dd391c4`: 100 tests, 93 passed, 7 failed, zero skipped. All prior 91 tests passed; the two new preexisting-unassociated-popup and explicit-unsupported-label rejection tests already passed. The two positive generic tests failed before reading the popup; three missing/unsupported/ambiguous cases failed the expected opening assertion, and two final readback cases returned EFFORT_CURRENT_UNKNOWN before mutation instead of the expected EFFORT_NOT_APPLIED.

## Correction and evidence boundary

Generic labels alone are insufficient. Require an exact single aria-controls ID, unique visible associated popup and unique visible named slider with an exact supported aria-valuetext; reject unsupported or ambiguous values and do not infer a numeric or default level. For a mutation the selected track must be the slider or its descendant. Preserve the existing guarded hit-test and drag path, and verify either an exact composer label or the same still-associated slider's exact final value. A closed popup with a generic trigger cannot establish successful readback. The fallback may open the associated picker once for inspection; no unsupported effort selection or automatic retry is introduced. Existing three-level API, permissions, protocol and signing workflow remain unchanged. Other real UI structures remain unsupported until evidence is available.

Green CI: pending verification.
