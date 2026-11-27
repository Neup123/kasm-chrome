# Signed Release 0.1.3 restart fixture

Scope: disposable GitHub-hosted CI only, using the existing internal synthetic fixture, fresh named Docker volume and private network. The authenticated isolated Coolify driver gate remains closed. No live requests, existing profile, real account, production host, deployment, signing or external credentials are involved.

The original signed Release smoke stops before the ESR restart sequence. This draft adds an explicit opt-in to run that sequence against the already signed Release artifact while leaving ordinary signed smoke unchanged. The PR workflow uses read-only repository permission and verifies the committed package against the reviewed source.

Evidence required from the new CI job:
- Verified signed package, successful Firefox Release startup and version check.
- Actual changed driver start timestamp, bridge ready again and unchanged named identities/cookie/localStorage markers A and B on the internal fixture.
- Actual changed browser start timestamp, unchanged fresh CI profile volume, same named identities and marker readback without reseeding, and active signed extension with the expected version.
- Distinguish disposable fixture results from deployed restart, runtime mount, backup, rollback and actual ChatGPT tests. These deployed criteria remain NOT RUN.

CI result: pending until checked against completed job output.
