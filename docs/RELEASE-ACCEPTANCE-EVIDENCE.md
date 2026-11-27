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

The isolated authenticated driver channel is blocked. Prior diagnostics encountered a Coolify Server Error and a subsequent command update was explicitly blocked. Do not retry that update, create a substitute execution channel, retrieve credentials, or touch existing sessions. The sole remaining acceptance items require the approved channel to be available and an authenticated, dedicated ChatGPT test conversation with the necessary controls and harmless test connector. The evidence above does not mark them complete.
