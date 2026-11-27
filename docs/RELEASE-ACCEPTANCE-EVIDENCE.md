# Isolated Release 0.1.3 acceptance evidence — 2026-11-27

Scope: isolated Coolify application `ykaquddwjrtu8of2qm0cafzq` only. No production, existing conversations, secrets, merges or further deployments. The live authenticated driver channel is a closed gate: do not retry the blocked command or use an alternative path to bypass it.

## Release provenance (PASS)

- Reviewed extension tree: `6e2ab512e420e8849832cc279171ee8c4d37ab1e`.
- Successful [protected AMO signing run 45965157214](https://github.com/Neup123/kasm-chrome/actions/runs/45965157214), artifact [15181569855](https://github.com/Neup123/kasm-chrome/actions/runs/45965157214/artifacts/15181569855).
- Manifest version: 0.1.3; extension ID: `kasm-agent@chabad.gr`; channel: unlisted.
- XPI SHA-256: `06daaffce4d70e47568a33bee00c15ab4df5231f754fee0ec9eefbee0deb3d46`.
- Archive SHA-256: `005ffe16836259ba907966d0f2b77139aa05458a7e30ba2a2fe61b8700323f11`.
- Independent archive download: exact XPI Git blob `3de4aef1611c8e7e6de2054d75929f99e2b0fe7b` matches the promoted repository artifact. All six non-manifest payload files match the reviewed Git blobs byte-for-byte; exact payload file set and five classic/COSE signature entries confirmed. The CI verifier separately checks manifest JSON semantics.
- [Failed signing run 45965185873](https://github.com/Neup123/kasm-chrome/actions/runs/45965185873) submitted the same extension tree at 08:27:21 UTC, after successful signing at 08:27:02, and failed at 08:27:27. Duplicate submission is the leading explanation, not a confirmed AMO error code; remote output is suppressed. No repeat signing is required for unchanged extension source.
- [Validation 45964156869](https://github.com/Neup123/kasm-chrome/actions/runs/45964156869): 73 tests passed, zero failed/skipped, lint clean. [Signed Release integration 45971188640](https://github.com/Neup123/kasm-chrome/actions/runs/45971188640/job/140411752357): exact acceptance source `fc1c636410f2bf1b7973ff7d612c77759ed3698b`, Firefox 160.0.1, active signature state 2, authenticated fixture bridge, independent cookie/storage contexts, typing/click readback, synthetic Escape, cross-context rejection, API base and gateway authentication, isolated topology and fresh fixture tab.

## Application receipt

- Application: Kasm Release Acceptance / acceptance / kasm-release-acceptance-012.
- Compose: `docker-compose.release-acceptance.yml`; branch: `test/release-0.1.2-coolify-acceptance`.
- Last confirmed completed deployment: `wgmbtwanrqmxuo2fnhniurws`, commit `fc1c636410f2bf1b7973ff7d612c77759ed3698b`. Container start reported; not proof of application health.
- Browser: https://kasm-release-acceptance-012.chgr.duckdns.org:1004/
- API base: https://kasm-release-acceptance-012.chgr.duckdns.org:1004/agent-driver/v1
- Credential references only: `SERVICE_HEX_64_ACCEPTANCEAPI`, `SERVICE_PASSWORD_ACCEPTANCEVNC`. No values recorded.
- Owner reports sign-in to a free test account; authenticated state and composer not independently verified. A free plan does not establish availability of every model/effort/connector control.

## Control coverage

| Control | Offline/fixture evidence | Actual ChatGPT acceptance |
| --- | --- | --- |
| tabs.setEffort | Existing and accessible Ask ChatGPT composer fixtures, drag and label readback, duplicate/ambiguous anchor guards; signed Firefox origin guard | NOT RUN |
| tabs.approve | Read-only inspection, exact full-conversation menu grant, wrong second item rejection, pointerdown/focus-trap fixture; signed Firefox origin guard | NOT RUN |
| tabs.key | Focus and credential guard fixtures; Escape delivered and observed in real signed Firefox internal fixture | NOT RUN |
| tabs.inspectAt / tabs.clickAt | Exact hit geometry, off-center pointer sequence, one-use inspection and changed/covered/credential rejection fixtures; signed Firefox origin guard | NOT RUN |
| tabs.mapInteractive | Role-less affordance, semantic role and visibility/credential exclusion fixtures | NOT RUN |

The synthetic DOM assertions are not positive tests against the real ChatGPT frontend. The signed Firefox integration uses an internal fixture, not a signed-in ChatGPT page. Dispatch alone does not prove application acceptance.

## Remaining gate

The isolated authenticated driver channel is blocked. Prior diagnostics encountered a Coolify Server Error and a subsequent command update was explicitly blocked. Do not retry that update, create a substitute execution channel, retrieve credentials, or touch existing sessions. The remaining isolated live acceptance items require the approved channel to be available and an authenticated, dedicated ChatGPT test conversation with the necessary controls and harmless test connector. The evidence above does not mark them complete.

## Promotion history and channel handoff

[Draft PR #13](https://github.com/Neup123/kasm-chrome/pull/13) staged the identical signed artifact and a read-only signed-Release CI job. Its [signed Firefox CI 45985396758](https://github.com/Neup123/kasm-chrome/actions/runs/45985396758) and [validation 45985396744](https://github.com/Neup123/kasm-chrome/actions/runs/45985396744) passed. Independently of that draft, [PR #14](https://github.com/Neup123/kasm-chrome/pull/14) was merged at 10:53:04 UTC into main commit `bd483159ba9b2268bac54b8bd5ceadf80e9a76e6`. Main now contains the exact signed XPI blob, metadata blob, extension tree, driver tree and Firefox Dockerfile as the isolated integration branch. [Main validation 45985836788](https://github.com/Neup123/kasm-chrome/actions/runs/45985836788) passed. The revised signed-release workflow in #13 was not part of #14. Repository promotion is not live deployment or acceptance. No merge or deployment was performed in this documentation follow-up.

The `kasm for tests` connection was reported configured in INFO, but the last permitted discovery exposed no driver tools or workspace connections to this conversation. This is a channel availability blocker, not evidence of an HTTP authentication failure: no driver request or error body was obtained in the last discovery attempt. No further connection tests are authorized while the gate is closed. Keep all real UI checks NOT RUN.

No subsequent isolated redeployment was performed: the recorded completed deployment points to a commit containing the source-matching signed 0.1.3 package. Runtime version and authenticated composer still require independent live confirmation.

## Test-level traceability

[Release test traceability](RELEASE-TEST-TRACEABILITY.md) maps all 73 executed automated tests to immutable source files and successful CI output, separates positive synthetic tests from negative signed-Firefox origin checks, and identifies the signed Release restart/persistence gap in the actual CI script. No new deployed evidence is claimed.

## Signed Release restart fixture follow-up

[draft PR #15](https://github.com/Neup123/kasm-chrome/pull/15) and [signed Release restart fixture job 140511960304](https://github.com/Neup123/kasm-chrome/actions/runs/46000898359/job/140511960304) independently establish signed 0.1.3 disposable CI driver/browser restart, reconnection, unchanged synthetic context/volume identity and persistent independent markers. They do not prove any deployed restart, runtime mount, rollback, backup or real ChatGPT action. The prior deployment receipt and closed gate remain unchanged.

## Disposable profile recovery follow-up (2026-11-27)

[signed backup/restore fixture job 140520386269](https://github.com/Neup123/kasm-chrome/actions/runs/46003376739/job/140520386269) passed in [draft PR #15](https://github.com/Neup123/kasm-chrome/pull/15) at tested commit `48182d3a5799cc94f508207838a8ec484fb0c9fd`. The stopped synthetic profile was archived from a read-only volume, checksum verified, restored to a separate empty volume, and opened in a newly created Firefox Release 160.0.1 container using the same image. Both named identities and independent cookie/localStorage markers survived without reseeding; signed extension 0.1.3 remained active (signedState 2). The original disposable volume was retained during the test. This proves same-image synthetic backup recovery only, not a deployed backup/restore, image-version rollback, real profile preservation, live TLS/proxy or real ChatGPT controls. The deployed acceptance criterion remains NOT RUN and the authenticated channel remains closed.

## Documentation-commit CI reconciliation

The three previously pending runs are complete and independently checked against their job logs: [repeat signed restart/restore CI](https://github.com/Neup123/kasm-chrome/actions/runs/46006819682/job/140531948215), [test draft validation](https://github.com/Neup123/kasm-chrome/actions/runs/46006819676/job/140531948357), and [documentation draft validation](https://github.com/Neup123/kasm-chrome/actions/runs/46006860933/job/140532086072), all PASS. The repeat signed run verified both disposable restarts and backup/restore with the same signed artifact; the other two runs each passed 73/73 tests and full validation. [Verification record](VERIFICATION.md) now records all eight criteria with specific CI receipts, explicit NOT RUN deployed disposition and the precise missing evidence. The internal gateway test is not a deployed external HTTPS or authenticated KasmVNC desktop test. Same-image profile recovery is not image-version rollback. No unblocked evidence-only acceptance item remains in the current repository matrix. No additional CI rehearsal is needed merely to restate a live-only gap; new work would require a distinct authorized criterion. The authenticated channel remains closed.

## Separate 0.1.4 candidate evidence

[Draft PR #16](https://github.com/Neup123/kasm-chrome/pull/16) remains an unsigned candidate against the isolated integration branch. Its [green regression run](https://github.com/Neup123/kasm-chrome/actions/runs/46010708287/job/140545175017) passed 79/79 tests including six fresh-composer synthetic regressions; its [documentation validation](https://github.com/Neup123/kasm-chrome/actions/runs/46011391534/job/140547502211) passed. This does not update the signed 0.1.3 release evidence or establish a real fresh-conversation markup match. The earlier reported live 0.1.2 missing-anchor error is historical, not a verified observation of the sibling-toolbar hypothesis. All eight deployed criteria and all actual ChatGPT controls remain NOT RUN. The 0.1.4 branch does not contain a matching signed package.

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

## Final candidate evidence handoff

The [candidate evidence record](https://github.com/Neup123/kasm-chrome/blob/21e645ba399937c92380c454e459e330a571c58b/docs/FRESH-COMPOSER-EFFORT-EVIDENCE.md) now includes the independently recorded unsigned artifact receipt ([unsigned artifact 15206871717](https://github.com/Neup123/kasm-chrome/actions/runs/46018215466/artifacts/15206871717)). Latest [candidate validation 46023497091](https://github.com/Neup123/kasm-chrome/actions/runs/46023497091/job/140588835502) was rechecked: 79/79 tests, zero failures/skips, zero extension lint errors/warnings, unsigned 0.1.4 source equality; no signature. [Verification record](VERIFICATION.md#candidate-014--outstanding-acceptance-register-2026-11-27) enumerates the remaining candidate signing, signed-runtime, live identification, mutation, other control, deployment and rollback evidence requirements. This handoff does not change any 0.1.3 acceptance disposition or claim live evidence. All repository documentation items identified in the current scope are closed; release and deployed acceptance remain blocked or NOT RUN. The authenticated channel remains closed.

## Combined candidate identity reconciliation

The separate fresh-composer and five-tick unsigned drafts #16 and #17 each passed 79 tests. The combined unsigned review candidate in [draft #18](https://github.com/Neup123/kasm-chrome/pull/18) passed 91/91 tests, including six joint regressions. None has a matching signed package; all three have the same provisional 0.1.4 manifest but distinct source trees. [PR #18 evidence](https://github.com/Neup123/kasm-chrome/blob/436cbd8b3dc16aa3b1b1791cec8e78992a549e91/docs/COMBINED-EFFORT-EVIDENCE.md) records the exact composition of the separate #16 and #17 fixes. Rechecked [five-tick final CI](https://github.com/Neup123/kasm-chrome/actions/runs/46043162623/job/140655723185) (79/79) and [combined final CI](https://github.com/Neup123/kasm-chrome/actions/runs/46059206124/job/140709069811) (91/91): both succeeded, zero failures/skips and zero extension lint errors/warnings. Both jobs report unsigned packages with source equality. The [PR #16 evidence](https://github.com/Neup123/kasm-chrome/blob/21e645ba399937c92380c454e459e330a571c58b/docs/FRESH-COMPOSER-EFFORT-EVIDENCE.md) prior independent archive receipt applies only to #16. No independent archive-byte inspection of #17 or #18 is claimed. [Verification register](VERIFICATION.md#candidate-014--outstanding-acceptance-register-2026-11-27) now enumerates all three exact draft heads, distinct extension trees, shared manifest, unchanged signed 0.1.3 package and protocol identities, and outstanding acceptance receipts. PR #18 is the combined review candidate, not an accepted or promoted release. All eight deployed criteria and all real ChatGPT controls remain NOT RUN. The live gate and signing gate remain closed. No further execution is implied.
