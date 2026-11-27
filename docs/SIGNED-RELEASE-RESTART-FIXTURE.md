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
