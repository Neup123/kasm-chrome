# Private Firefox ESR experiment

Refs #4. This branch is an isolated experiment, not a production release.
The signed Firefox path remains intact. Mozilla documents unsigned extension
installation on ESR, the locked preference, and extension allowlisting:
https://extensionworkshop.com/documentation/enterprise/enterprise-distribution/
https://mozilla.github.io/policy-templates/
https://support.mozilla.org/en-US/kb/install-firefox-linux

The image uses the existing Kasm base and startup loop, official Mozilla APT
packages with checked repository key, the existing extension build and verifier,
and derives its policy from the production policy. Only the experimental image
turns off extension signature enforcement, blocks other extensions, and uses a
fresh profile. The private extension remains source-verified, not AMO-verified.
The test uses a separate internal network, synthetic credentials and new volume;
no host ports or production resources are used. No AMO keys are required.

Run: on a disposable Linux Docker runner with CI=true, run
`bash scripts/run-esr-smoke.sh`. CI runs this automatically on the experiment
branch. It tests the real ESR process and policy-installed extension via the
existing authenticated HTTP and WebSocket driver, two isolated cookie/storage
sessions, type/click/readback, wrong-context rejection, and restart persistence.

Limitations: no real ChatGPT account, no KasmVNC GUI click inventory, no Coolify
production routing or existing profile migration. An ESR downgrade of the
release profile is not approved; test with a new profile only. Do not promote
until the smoke run is green and separate Coolify/Authelia and backup checks
are complete. The Kasm base is a rolling tag; capture the tested image digest
before any promotion. State machine implementation is unchanged; the smoke
test exercises the existing API and state transitions.
