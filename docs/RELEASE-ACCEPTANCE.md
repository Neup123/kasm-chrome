# Isolated Firefox Release acceptance
Dedicated Coolify project Kasm Release Acceptance, environment acceptance,
application UUID ykaquddwjrtu8of2qm0cafzq. Never uses a production profile,
network, route, or credential. No automatic Coolify deployment is configured.

- Compose: /docker-compose.release-acceptance.yml
- Only gateway port 8081 is routed, over a unique HTTPS hostname.
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
