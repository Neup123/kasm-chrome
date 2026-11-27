# Isolated Firefox Release acceptance
This branch is solely for the separate Coolify project Kasm Release Acceptance,
environment acceptance. It never uses the main Kasm profile, network, routes or
credentials. No automatic deployment is configured in this source.

- Compose: /docker-compose.release-acceptance.yml
- Route only the gateway service, port 8081, using a unique TLS hostname.
- Browser UI: gateway HTTPS root. KasmVNC authentication uses an independent
  password from the secure runtime environment.
- Driver API: same HTTPS host, /agent-driver/v1/status and /commands.
  Use X-API-Key from the dedicated secure runtime credential.
- Runtime environment secrets: ACCEPTANCE_VNC_PASSWORD and
  ACCEPTANCE_DRIVER_API_KEY (distinct, random; API key base64url of at least 32
  bytes). Set securely, not in Git or chat. Init generates a separate persistent
  WS token inside the managed-storage volume.
- Fresh app-scoped acceptance-profile volume; do not copy cookies from production.
- Do not route driver port 8080 or Firefox port 6901 directly.
- Deployment and real ChatGPT authentication require explicit owner authorization.
- After boot, verify /status rejects no key, reports ready with a valid key and
  extensionVersion 0.1.2. Create one dedicated named container, then open ChatGPT
  in it and have the owner sign in to a disposable test account with thinking
  effort and access to a harmless test connector. Never copy an existing session.
- With the isolated tab only, inspect its composer; test setEffort High and verify
  the label. For approve, request read-only access to a test resource, inspect the
  exact pending question and description, then grant only the named test service
  after explicit approval for that test. Verify the result. Never use a production
  service approval or existing conversation.
