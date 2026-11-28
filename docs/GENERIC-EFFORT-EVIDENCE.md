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

## Independent unsigned archive receipt (2026-11-28 UTC)

Downloaded [artifact 15233278554](https://github.com/Neup123/kasm-chrome/actions/runs/46072542679/artifacts/15233278554) from the completed [final validation job 140752639001](https://github.com/Neup123/kasm-chrome/actions/runs/46072542679/job/140752639001) at exact commit `a7ef3f687f1e8e8788345e6340f77ef935a3ca73`. Rechecked the job log: 100/100 tests, zero failures/skips, zero lint errors/warnings, source_files_match=true and signature_entries_present=false. Independently inspected the downloaded ZIP/XPI bytes using Python zipfile/hashlib; CRC checks and exact entry inventories passed for both archives.

| Check | Observed result |
| --- | --- |
| Outer ZIP size | 22,678 bytes |
| Outer SHA-256 | `85e46438660d64a182b978b71fffe58f922a8732e13b5412c37e99b8cd02d3bf` — matches metadata and CI log |
| Outer inventory | Exactly one kasm-agent-unsigned.xpi |
| XPI SHA-256 | `605bedf4817ffc41fdb7375bc16b2d3316249a8b5f17e9d224a195b933115b13` — matches CI log |
| XPI inventory | Exactly seven expected files; no duplicate or additional entries |
| Git blob equality | 7/7 match candidate tree `9b7ad80f81dadc2891545e9a7b0dfc72894f3cd8` |
| Manifest | 0.1.4; extension ID kasm-agent@chabad.gr |
| Signature | No signature entries; unsigned |

Computed Git blob SHA-1 over each actual payload's Git blob header and bytes: LICENSE `fb698beea6cd2d6dc5001c794325cde723428230`, background.js `b9031b035e77e1f933d529967b386226b3622ee6`, content.js `50638e3cf506947d5aad4a8539d3d2f85fdeadae`, core.js `3a03491644edfb512ff1b3abc4cac6d3a5cdcd4a`, manifest.json `bac18e5a82a93f3319149947ba00f8d57c015320`, protocol.js `d149897d904ce57eb9f7cedc1b6ebe429de319d1`, transport.js `041c5698c039e30d062206308aa7d588c4ee76d5`. Every calculated hash equals its immutable repository blob. Archive hashes are specific to these builds, not a reproducible ZIP timestamp claim.

**Closed:** independent unsigned-package provenance of #19. The earlier CI-only receipt is historical for a different build of the same tree. This proves neither signature trust nor installation, live generic or five-tick identification, actual High readback or deployed acceptance. Signing and runtime gates remain closed; no execution against a live driver, signing, merge or deployment occurred.
