# Isolated Firefox Release acceptance
Dedicated Coolify project Kasm Release Acceptance, environment acceptance,
application UUID ykaquddwjrtu8of2qm0cafzq. Never uses a production profile,
network, route, or credential. No automatic Coolify deployment is configured.

- Compose: /docker-compose.release-acceptance.yml
- Only the gateway is routed, on its internal port 80 (8081 is retained for internal probes).
  External HTTPS uses the existing server listener on port 1004, not port 443.
  Browser: https://kasm-release-acceptance-012.chgr.duckdns.org:1004/.
  Driver: https://kasm-release-acceptance-012.chgr.duckdns.org:1004/agent-driver/v1.
  In the reviewed gateway configuration the exact API base is an authenticated status alias; the CI fixture expects HTTP 401 for unauthenticated requests. The live external response has not been independently verified. A reported 404 is not a reliable version or authentication diagnosis.
- Coolify generates distinct SERVICE_PASSWORD_ACCEPTANCEVNC and
  SERVICE_HEX_64_ACCEPTANCEAPI credentials. Do not print, retrieve into chat,
  or reuse these values. The init service creates a separate random WS token
  and stores it in the application-scoped managed volume. Driver API key and
  gateway Basic-auth password hash are stored in separate scoped volumes.
- Browser root: KasmVNC user kasm_user and the generated VNC password from
  Coolify Environment Variables. Gateway also requires Basic authentication.
- Driver API: /agent-driver/v1/status and /commands, X-API-Key from the
  generated API credential. Never expose port 8080, /ws or internal fixtures.
- Persistent acceptance-profile volume is new; no cookie import.
- Bootstrap checks unauthenticated access is rejected, then creates exactly one
  named acceptance container and one fresh tab if it has no tabs. Never touches
  an existing tab. CI mode uses an internal fixture; runtime uses chatgpt.com.
- An owner must sign in manually to a dedicated test account (no credential
  automation or copied sessions). Only a harmless test connector may be used.
  Record exact pending approval text; authorize full conversation only after
  explicit test authorization. Test setEffort High with before/after label
  evidence. Actual ChatGPT acceptance cannot be inferred from bootstrap.

Gateway configuration and bootstrap script are copied into their own images, not mounted from the host. This avoids Coolify/WSL Docker Desktop file-bind type mismatches. Only application-scoped named volumes remain.

For current verified evidence and the closed live acceptance gate, see [Release acceptance evidence](RELEASE-ACCEPTANCE-EVIDENCE.md). For the original eight criteria and their remaining gaps, see [Verification record](VERIFICATION.md). Do not initiate driver requests while the gate remains closed.
