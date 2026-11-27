# Signed Release 0.1.3 restart fixture

Scope: disposable GitHub-hosted CI only, using the existing internal synthetic fixture, fresh named Docker volume and private network. The authenticated isolated Coolify driver gate remains closed. No live requests, existing profile, real account, production host, deployment, signing or external credentials are involved.

The original signed Release smoke stops before the ESR restart sequence. This draft adds an explicit opt-in to run that sequence against the already signed Release artifact while leaving ordinary signed smoke unchanged. The PR workflow uses read-only repository permission and verifies the committed package against the reviewed source.

Evidence required from the new CI job:
- Verified signed package, successful Firefox Release startup and version check.
- Actual changed driver start timestamp, bridge ready again and unchanged named identities/cookie/localStorage markers A and B on the internal fixture.
- Actual changed browser start timestamp, unchanged fresh CI profile volume, same named identities and marker readback without reseeding, and active signed extension with the expected version.
- Distinguish disposable fixture results from deployed restart, runtime mount, backup, rollback and actual ChatGPT tests. These deployed criteria remain NOT RUN.

## Observed result — PASS, 2026-11-27

- Exact tested draft commit: [`ab9a59251e71b1da0186e7caa44b9c1475306f0c`](https://github.com/Neup123/kasm-chrome/commit/ab9a59251e71b1da0186e7caa44b9c1475306f0c).
- [Signed restart fixture job 140511960304](https://github.com/Neup123/kasm-chrome/actions/runs/46000898359/job/140511960304): completed successfully.
- [General validation job 140511959333](https://github.com/Neup123/kasm-chrome/actions/runs/46000898201/job/140511959333): 73/73 tests, zero failed/skipped; zero extension lint errors/warnings; API docs, Compose source checks and package build passed.
- XPI SHA-256 `06daaffce4d70e47568a33bee00c15ab4df5231f754fee0ec9eefbee0deb3d46`; source equality and signature entries verified both before and during image build. Reviewed extension tree unchanged.

| CI observation (UTC) | Verified result |
| --- | --- |
| 12:43:27–12:43:36 | Firefox Release 160.0.1, bridge ready for 0.1.3, API authentication, independent cookie/localStorage markers, type/click/readback, Escape and origin/cross-context guards; extension active, signedState 2, appDisabled/userDisabled false |
| 12:43:37 | Disposable driver restarted; changed start timestamp asserted; bridge returned ready; exact pre-restart named identities and both distinct markers read back without reseeding |
| 12:43:52 | Expected profile files exist on the isolated mounted CI volume |
| 12:44:01 | Disposable Firefox restarted; changed start timestamp and unchanged named profile volume asserted; bridge returned ready; same named identities and both cookie/localStorage markers read back; extension still active, version 0.1.3, signedState 2, appDisabled/userDisabled false |

The post-restart fixture opens the bare internal fixture URL, without a slot parameter, so it does not reseed either marker. Successful exit requires both restart timestamp assertions and the volume identity assertions. The test uses a CI-specific explicit profile path, not the deployed acceptance profile. The log shows successful readback after both restarts; it does not prove a backup or restore, an image upgrade, a rollback, the Coolify runtime mount, external proxy availability, or authenticated ChatGPT functionality.

**Closed:** signed Release restart/reconnect and fixture persistence evidence gap on disposable CI. **Still NOT RUN:** all deployed acceptance criteria, including actual isolated-stack restart/persistence and rollback, and every real ChatGPT control test. The authenticated channel remains closed. No gate retry or bypass is authorized.

## Follow-up: disposable profile backup/restore rehearsal

The next acceptance subcriterion is restorable profile data. The same fixture harness is extended rather than duplicated in another PR against the same integration branch. The opt-in backup step runs only on GitHub-hosted CI, after successful signed Release restart checks, with synthetic markers and no external network. It stops/removes the disposable browser, archives only its CI profile via a read-only mount, verifies the archive checksum, restores into a distinct empty volume, recreates the browser with the same image, and reuses the existing bare-URL fixture readback (no reseeding). The source volume remains present throughout the rehearsal. Archive bytes are not uploaded or logged; CI cleanup removes the temporary archive and both disposable volumes. This is same-image backup recovery, not an image downgrade, upgrade, production rollback or actual Coolify backup. No runtime application code or extension changes.

### Observed backup/restore result — PASS, 2026-11-27

- Exact tested commit: [`48182d3a5799cc94f508207838a8ec484fb0c9fd`](https://github.com/Neup123/kasm-chrome/commit/48182d3a5799cc94f508207838a8ec484fb0c9fd).
- [Signed restart and restore CI job 140520386269](https://github.com/Neup123/kasm-chrome/actions/runs/46003376739/job/140520386269) completed successfully.
- [General validation job 140520386005](https://github.com/Neup123/kasm-chrome/actions/runs/46003376654/job/140520386005): 73/73 tests, zero failed/skipped; zero lint errors/warnings; API docs, Compose source checks and package build passed.

| UTC log timestamp | Verified result |
| --- | --- |
| 13:01:15–13:01:45 | Signed 0.1.3, Firefox Release 160.0.1, original restart sequence passed |
| 13:01:50.571 | Stopped synthetic profile archived from read-only volume; archive checksum verified |
| 13:01:50.947 | Checksum-verified archive restored into a separate empty volume |
| 13:01:55.290–13:01:55.461 | Recreated browser connected with same named identities and independent persistent cookie/localStorage markers |
| 13:01:55.529 | Restored profile reports extension 0.1.3 active, signedState 2, appDisabled/userDisabled false |
| 13:01:55.533 | Recreated signed browser on restored CI volume; original volume retained; independent markers read without reseeding |

The successful exit also requires the assertions that the recreated browser has a different container ID, the same image ID, the new volume mounted at the intended CI path, and the original volume still exists. No archive bytes, session data or secret values are retained in the evidence. The test does not verify a backup from the deployed profile, restoration on Coolify, image-version rollback, the production volume or proxy, or actual ChatGPT interaction. All deployed acceptance criteria remain NOT RUN; the closed channel was not used.

**Closed subcriterion:** same-image restoration of a stopped synthetic signed Release profile into a separate fresh CI volume. **Unproven:** deployed backup/restore, image rollback and the remaining real application acceptance gates.
