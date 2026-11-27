# Generic Thinking effort identification — synthetic evidence

Scope: repository source and synthetic DOM tests only. No signing, runtime verification, live driver connection, deployment or merge. This draft copies the exact combined #18 review tree (`90ab79836bd41799f7c79c24082cbf265796f377`) into a single-parent branch against the isolated integration baseline `fc1c636410f2bf1b7973ff7d612c77759ed3698b`. Earlier PRs are unchanged. Manifest remains provisional 0.1.4; old signed 0.1.3 artifact is not a candidate signature.

## Exact gap

The user reports a fresh-conversation composer with a generic Thinking effort trigger and no identifiable level. In [the combined source](https://github.com/Neup123/kasm-chrome/blob/90ab79836bd41799f7c79c24082cbf265796f377/extension/content.js), effortLabel returns null for the generic label, and setEffort throws EFFORT_CURRENT_UNKNOWN before opening the picker. This is separate from finding the trigger and the five-tick geometry work. No live markup or slider value metadata was independently observed; the explicit aria-controls / aria-valuetext structure is a constructed fixture, not a claim about the deployed UI.

[Red validation](https://github.com/Neup123/kasm-chrome/actions/runs/46072298472/job/140751855322) on tests-only relative-to-#18 commit `9a3fef280d01eb99cfb0cf216c728db34dd391c4`: 100 tests, 93 passed, 7 failed, zero skipped. All prior 91 tests passed; the two new preexisting-unassociated-popup and explicit-unsupported-label rejection tests already passed. The two positive generic tests failed before reading the popup; three missing/unsupported/ambiguous cases failed the expected opening assertion, and two final readback cases returned EFFORT_CURRENT_UNKNOWN before mutation instead of the expected EFFORT_NOT_APPLIED.

## Correction and evidence boundary

Generic labels alone are insufficient. Require an exact single aria-controls ID, unique visible associated popup and unique visible named slider with an exact supported aria-valuetext; reject unsupported or ambiguous values and do not infer a numeric or default level. For a mutation the selected track must be the slider or its descendant. Preserve the existing guarded hit-test and drag path, and verify either an exact composer label or the same still-associated slider's exact final value. A closed popup with a generic trigger cannot establish successful readback. The fallback may open the associated picker once for inspection; no unsupported effort selection or automatic retry is introduced. Existing three-level API, permissions, protocol and signing workflow remain unchanged. Other real UI structures remain unsupported until evidence is available.

## Observed red/green result — PASS

[Completed validation run 46072419428, job 140752236414](https://github.com/Neup123/kasm-chrome/actions/runs/46072419428/job/140752236414) tested commit `d1ce0c61bbce76b3d60fb992bb76388377e371bc`. Independently reviewed job logs: 100/100 tests passed (all 91 previous combined tests and all nine new cases), zero failed/skipped; zero extension lint errors/warnings; API docs drift, Compose source controls, unsigned XPI build, source verification and artifact upload passed.

| Synthetic case | Observed corrected result |
| --- | --- |
| Generic trigger; explicitly associated named slider at Medium | PASS — exact High readback, previous=Medium, one drag |
| Generic trigger; associated slider already High | PASS — unchanged, verified, zero drag |
| Missing current value | PASS — EFFORT_CURRENT_UNKNOWN; one opening, no drag |
| Unsupported current slider value Extra High | PASS — EFFORT_CURRENT_UNKNOWN; no drag |
| Ambiguous associated sliders | PASS — EFFORT_CURRENT_UNKNOWN; no drag |
| Preexisting unassociated popup | PASS — EFFORT_CURRENT_UNKNOWN; no drag or new opening |
| Final slider value Extra High | PASS — EFFORT_NOT_APPLIED; no false High readback |
| Closed popup; trigger still generic | PASS — EFFORT_NOT_APPLIED; no fabricated verification |
| Explicit unsupported trigger value | PASS — EFFORT_CURRENT_UNKNOWN; no opening or drag |

Candidate extension tree `9b7ad80f81dadc2891545e9a7b0dfc72894f3cd8`. CI unsigned XPI SHA-256 `342d4628c93f6d3800f96615e9dae72eb7f34901912fcbfc641ac54c6290f58b`; source_files_match=true and signature_entries_present=false (job receipt, not independently downloaded archive). Exact repository tree confirms unchanged manifest `bac18e5a82a93f3319149947ba00f8d57c015320`, protocol `d149897d904ce57eb9f7cedc1b6ebe429de319d1`, driver tree `1918ce8395a8f8209264460da64aa5a92c11d68d`, retained signed 0.1.3 XPI `3de4aef1611c8e7e6de2054d75929f99e2b0fe7b` and signed metadata `f01597d36de048cf9661deebccdb5a7e897bf00c`. New source is not the previously signed release.

**Closed:** the reproducible source-level early-abort gap when a generic trigger has the explicit association and supported value metadata represented by the constructed fixtures. **Unproven:** actual fresh-conversation DOM and whether it exposes aria-controls and a named slider with aria-valuetext, generic fallback on a live five-tick layout, actual High mutation/readback, signed installation, runtime and deployment. The new generic-specific positive fixtures use three ticks; the earlier five-tick and joint cases are preserved, not evidence that the actual generic UI has either structure. If no explicit supported level is available even in the picker, identification still fails closed. No default is assumed. The signing and runtime verification items remain untouched; no signing, merges, deployments or live connection attempts were made.
