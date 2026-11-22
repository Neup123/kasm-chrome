# Deployment and live acceptance

## Status and release gates

This guide is an executable handoff for the deployment agent. It is not a
claim that an image has been built or that the production acceptance checks
have passed. The acceptance record must contain live evidence for every gate
below. Unit tests, source inspection and a successful build are separate
evidence classes.

The source lives at <https://github.com/Neup123/kasm-chrome>, branch
`feat/firefox-agent-driver`, Compose path `/docker-compose.yml`, base directory
`/`. Deploy the exact reviewed commit from that branch through the Coolify API.
Do not merge merely to deploy. No Coolify UI save action is part of this guide.
Leave any existing unsaved UI form alone.

Three gates must complete before the first production mutation:

1. Run the local functional suite and the deployment source check.
2. Obtain the AMO-signed XPI and validate it against the exact source and release
   metadata. Do not change the signed archive after signing.
3. Read the live application's settings and runtime resource identities, record
   rollback data privately, and confirm a usable deployment API connection.

If a read fails at the connector/tunnel, an API permission check returns 403, a
secret source is unavailable, or an actual volume/network name is unknown,
stop deployment and report the specific blocker. Do not use the Coolify UI to
work around the failure. Source preparation can continue while deployment is
blocked.

## Why startup remains unchanged

`firefox/Dockerfile` retains
`kasmweb/firefox:1.18.0-rolling-weekly` as the final base. It does not define
`ENTRYPOINT`, `CMD`, a new browser profile, debug flags, or a replacement
`custom_startup.sh`. The inherited Kasm startup continues to handle
`APP_ARGS`, `LAUNCH_URL`, the persistent home and the browser restart loop.

Kasm's published `release/1.18.0` base Dockerfile declares this entrypoint:

```json
["/dockerstartup/kasm_default_profile.sh", "/dockerstartup/vnc_startup.sh", "/dockerstartup/kasm_startup.sh"]
```

The source default command is `["--wait"]`. Before building, inspect the actual
base image and compare these values, its user and the Firefox executable.
The rolling tag can change; source inspection alone does not prove the current
registry image. Preserve the currently deployed image ID/digest for rollback.

The custom image copies `firefox/policies.json` to
`/etc/firefox/policies/policies.json`, the location documented by Kasm.
`ExtensionSettings` force-installs `kasm-agent@chabad.gr` from
`file:///opt/kasm-driver/companion.xpi`. No public download endpoint is needed.
The policy enables container identities and their UI, but does not create
another profile or replace the existing container list.

The build's first stage runs the canonical XPI verifier and copies only the
validated archive into the final image. A missing signed archive, mismatched
source or mismatched recorded hash stops the build. Signature-file presence
and a matching hash are structural checks; the definitive Mozilla trust check
is stock Firefox Release accepting and activating the extension at first boot.

## Runtime secrets and nonsecret settings

Secret values must travel from the approved secure vault to the deployment
environment. They never belong in Git, an issue, chat, Docker build arguments,
an image layer, an XPI, screenshots or command logs. Do not run a configuration
command that prints resolved secrets into a recorded console.

| Name | Kind | Destination and purpose |
| --- | --- | --- |
| `VNC_PW` | Existing secret | Preserve the current Kasm value and its existing secure reference. |
| `DRIVER_MANAGED_STORAGE` | New secret | One complete native managed-storage JSON document, used by Firefox and the driver. Contains the shared WS token. |
| `DRIVER_API_KEY` | New secret | Distinct long random key, mounted only into the driver. Agents send it as `X-API-Key`. |
| `AMO_JWT_ISSUER` | Signing-only secret | AMO Signing API credential; never needed at runtime. |
| `AMO_JWT_SECRET` | Signing-only secret | AMO Signing API secret; never needed at runtime. |
| `DRIVER_IMAGE_TAG` | Nonsecret | Unique immutable release tag, preferably the reviewed commit SHA. Never reuse a previous release's tag. |
| `KASM_PROFILE_VOLUME` | Nonsecret | Exact existing Docker volume mounted at `/home/kasm-user`; inspect it, never guess it. |
| `KASM_DOCKER_NETWORK` | Nonsecret | Exact existing network shared by the browser and the Traefik proxy; inspect it first. |
| `DRIVER_PUBLIC_HOST` | Nonsecret | Existing browser hostname only, with no scheme, path or port. |
| `TRAEFIK_HTTPS_ENTRYPOINT` | Nonsecret | Copy the current HTTPS entrypoint name. |
| `TRAEFIK_CERTRESOLVER` | Nonsecret | Copy the current working certificate resolver name. Stop if the site uses a different certificate arrangement; adapt and test that arrangement rather than inventing a resolver. |
| `BROWSER_AUTH_MIDDLEWARES` | Nonsecret | Preserve the current Authelia and Kasm header-injection middleware chain, in order, without a gzip middleware. |
| `BROWSER_SERVERSTRANSPORT` | Nonsecret | Preserve the current transport used for the Kasm HTTPS backend. |

`DRIVER_MANAGED_STORAGE` has this shape. The token marker is documentation only
and is not a usable credential:

```json
{
  "name": "kasm-agent@chabad.gr",
  "description": "Private Kasm automation bridge configuration",
  "type": "storage",
  "data": {
    "wsUrl": "ws://driver:8080/ws",
    "wsToken": "<securely-provisioned-shared-token>"
  }
}
```

Generate two independent cryptographically random secrets with at least 32
random bytes each, encoded as base64url or hex, inside the approved vault flow.
The API key and shared WS token must differ. The same managed JSON secret is
mounted into both containers, so its WS token cannot drift between two copies.
AMO credentials are requested only after the unsigned package is ready to sign.
If a secure credential-card or vault-write channel is not exposed, state that
blocker; never ask for values in chat or claim an unavailable secure channel.

The Compose secret sources use native `environment:` support. Docker creates
the secret files before container start with UID/GID 1000 and mode 0400:

| Container | File |
| --- | --- |
| Firefox | `/usr/lib/mozilla/managed-storage/kasm-agent@chabad.gr.json` |
| Driver | `/run/secrets/driver_managed_storage` |
| Driver | `/run/secrets/driver_api_key` |

The driver receives the filenames through `DRIVER_MANAGED_STORAGE_FILE` and
`DRIVER_API_KEY_FILE`. Firefox reads the same JSON through `storage.managed`.
No startup wrapper or policy templating is required. The Firefox mount is
outside the persistent home volume. A browser restart reloads managed storage.

Native environment-backed secrets require a writable container filesystem
during Compose injection, so the driver is deliberately not `read_only`.
It runs as UID 1000, drops all Linux capabilities and prevents gaining new
privileges. It has no host port binding and no Docker socket mount.

Recent Coolify versions support vault references such as `{{vault.KEY}}` and
resource secret-manager API endpoints. Verify that the installed version and
existing source support this route. The API reports key names, not secret
values. If unsupported, use the already approved vault-to-deployment channel;
do not create a substitute insecure handoff. Check that the two secret source
variables reach Compose's project environment; a variable inside a service's
environment alone is not the same thing.

## Live preflight: capture before changing anything

Use the existing authenticated Coolify API connection. The API token is
already held by the deployment agent and must not be requested again.

1. Read the application, its settings, current deployment and storage records.
   Confirm the exact resource, service name `firefox`, source repository and
   branch, Docker Compose mode, domain mapping and port 6901. Record gzip as
   disabled. Read only the needed environment key names and secure references.
2. Inspect the running Firefox container's image ID/digest, command, entrypoint,
   user, mounts and networks. The runtime mount at `/home/kasm-user` is the
   authority for `KASM_PROFILE_VOLUME`. Verify it exists and is nonempty. Never
   create a volume merely because the expected name is missing.
3. Identify the exact network used by Firefox and its Traefik proxy. The new
   `driver` service attaches to this same existing network. Verify no other
   container on that network already owns the DNS alias `driver`; do not
   replace or rename another service.
4. Capture the actual browser router, HTTPS entrypoint, TLS certificate
   resolver, middleware chain and Kasm HTTPS transport. Middleware names alone
   are insufficient: verify the referenced objects exist and preserve their
   definitions. No Authelia configuration change is part of this deployment.
5. Record an unauthenticated HTTPS GET to the browser root without following
   redirects. It must return the existing 302 redirect to Authelia. Record
   status and a sanitized destination; do not record session cookies.
6. Save the previous commit/branch, complete recoverable deployment settings,
   image IDs and volume/network identities in the approved private operational
   record. Snapshot the home volume with the approved backup mechanism and
   verify the backup is restorable before the first browser image upgrade.
   Profile backups contain cookies; never commit them or publish their files.
7. Inspect the installed Docker Compose version and test support for
   environment-backed secret injection with UID 1000/mode 0400 and the absolute
   Firefox target path. A parse check alone does not prove the files exist or
   are readable at runtime. Use a harmless disposable fixture secret for this
   check, then remove that fixture container. No production profile is needed.

The Compose declarations mark the existing volume and network `external: true`.
This prevents Compose from silently substituting a new empty resource and
keeps these resources outside the stack's deletion lifecycle. Never run
`docker compose down -v`, delete the profile volume, or allow two Firefox
containers to write the same profile at the same time.

## Build and apply through the API

Run source validation from the repository root:

```bash
python3 scripts/check-compose.py
python3 scripts/check-compose.py --runtime
```

The first command checks source controls. The second also checks nonsecret
parameter shapes in the secure deployment environment and never prints their
values. These are not Docker execution or live security checks.

The secure agent can run `npm run sign:extension` directly. The signing workflow
can also run from a deliberately pushed `sign/**` branch at the reviewed source
after the `amo-signing` environment has its two credentials. Its optional manual
dispatch requires the workflow to exist on the default branch; a feature-only
workflow must not be represented as manually dispatchable before that condition
is met. No signing branch is created before credentials are securely available.

Signing returns `artifacts/kasm-agent-signed.xpi` and
`artifacts/signed-artifact.json`. Download those exact artifacts through the
authenticated GitHub connection and run the canonical verifier against the
reviewed source. Commit only those two final files on the deployment branch
before requesting a Coolify build. They contain the signed public extension
and a hash, never runtime or AMO credentials; `.gitignore` allows exactly those
two release files. Coolify builds a fresh Git checkout, so a signed XPI left
only on a workstation or in a workflow artifact is insufficient. Verify the
new commit still has byte-identical extension source and set `DRIVER_IMAGE_TAG`
to that release commit. Keep AMO credentials out of the runtime environment
and build context. The production build intentionally cannot proceed with
only the unsigned package.

After the signing and preflight gates pass, stage this minimal application
configuration through `PATCH /api/v1/applications/{uuid}` using the actual
installed API schema:

```json
{
  "git_repository": "https://github.com/Neup123/kasm-chrome",
  "git_branch": "feat/firefox-agent-driver",
  "build_pack": "dockercompose",
  "base_directory": "/",
  "docker_compose_location": "/docker-compose.yml",
  "is_raw_compose_deployment_enabled": true,
  "is_gzip_enabled": false,
  "is_auto_deploy_enabled": false,
  "instant_deploy": false
}
```

Do not include domain, port, storage or Authelia fields in this patch. Preserve
the saved domain metadata. Keep automatic deployment disabled during staging
so a source push cannot race the secret/signing gates. Read the settings back
and compare them against the preflight snapshot before starting a deployment.
If the API does not support these fields, stop; do not guess field names or
silently fall back to managed router generation.

Raw Compose mode is required because this file supplies complete stable
Traefik routers. A generated browser router without the existing authentication
chain must not coexist. The browser router routes the unchanged hostname to
HTTPS port 6901 through the preserved authentication/header middleware chain.
The API router has higher priority and matches only `/agent-driver/v1` and
`/agent-driver/v1/…`, with TLS and the driver's own API-key check. `/ws`,
`/fixtures/` and the signed XPI have no external driver route. No driver `ports`
mapping exists. Do not add the driver to Coolify's automatic public domains.

Use the deployment API for the exact reviewed commit/branch, wait for terminal
deployment status, and inspect sanitized build/runtime output. Verify the
actual resulting labels, networks, mounts and published ports, not just source
YAML. Preserve the existing single Firefox process and its home volume.
No deployment step logs into ChatGPT or fills a credential form.

## Live acceptance record

Use a unique run ID and retain sanitized API responses plus desktop screenshots
where UI appearance is required. Never include an API key, WS URL query token,
cookies or personal conversation text in evidence. Mark a check PASS only when
its described deployed behavior was observed; otherwise record FAIL or
NOT_RUN with a precise reason.

| # | Required live check | Evidence required |
| --- | --- | --- |
| 1 | Policy install on the first boot of the custom image | Stock Firefox Release version; unchanged startup; active policy without errors; extension present and active before any manual install; authenticated bridge handshake from that extension. This is the Mozilla-signature acceptance check. |
| 2 | `containers.ensure` creates `ChatGPT 1` and `ChatGPT 2` | Command responses with distinct `cookieStoreId` values and a desktop screenshot showing both container identities. Repeating ensure must reuse the same IDs. |
| 3 | Open `https://chatgpt.com/` in a named container | `tabs.create` response and a desktop screenshot showing the container color/icon on that tab. |
| 4 | Read, type and send in the ChatGPT composer | `tabs.readText` returns page text; `tabs.type` updates the verified composer; programmatic `.click()` on the verified send element submits one explicitly authorized harmless test message. Confirm the composer is empty and the message appears. If login is needed, record NOT_RUN pending the owner's login; never enter credentials. Do not retry failed physical mouse events. |
| 5 | Reconnect after app restart | Record the existing IDs, restart through Coolify, observe a new bridge connection, and run a fresh command successfully without a manual action. Recheck the same container IDs and tabs. |
| 6 | Two isolated simultaneous sessions | Use the driver's internal placeholder pages, with distinct cookie/storage markers in each named container, in the same Firefox process. Reload and verify A does not see B's marker and B does not see A's marker. Do not use real logins. |
| 7 | Authelia wall remains intact | After redeploy and restart, unauthenticated GET to browser root still returns 302 to the same Authelia origin. Unauthenticated API access is denied; external requests cannot upgrade the private `/ws` endpoint. Verify gzip is still disabled. |
| 8 | Rollback and volume preservation | Old image/deployment metadata and usable backup exist; record actual unchanged profile mount identity before/after. Perform a controlled restore of the previous deployment, verify the browser wall and profile data, then redeploy the signed release and verify reconnect. Merely retaining a tag does not prove a rollback rehearsal. |

The owner signs in once per named container after deployment. Those sessions
persist in the existing home volume. Owner login is outside automated
acceptance; the driver must not sign in, obtain a password or handle 2FA.

`tabs.eval` exposes only the packaged read-only probes described in the API
guide. It intentionally rejects arbitrary remote JavaScript to comply with
AMO's self-contained-code requirement. Do not use an unsigned extension or
disable signature enforcement to avoid that constraint.

## Rollback procedure

1. Stop the new application through the API and confirm its Firefox process
   has terminated. Do not delete the application or any storage.
2. Restore the exact preflight source/deployment configuration and prior image
   digest, along with its original router labels/settings. Keep gzip disabled.
   The old repository snapshot may contain stale label names or a gzip label;
   it is not a substitute for the verified live snapshot.
3. Start exactly one Firefox service with the unchanged existing volume and
   network. Verify the 302 Authelia wall and the expected profile data.
4. If an actual profile restore is needed after an incompatible browser
   upgrade, stop Firefox first and use the verified private backup procedure.
   Never create another browser profile as a workaround and never overwrite a
   live profile. Recheck data after the restore.
5. Record the outcome and either leave the working prior deployment active or
   redeploy the corrected signed release through the same API gates.

## Sources and verification limits

- [Kasm Firefox managed policy image instructions](https://docs.kasm.com/docs/latest/how-to/workspaces-sessions/container-workspace/chrome-managed-policies)
- [Kasm release/1.18.0 base image entrypoint](https://github.com/kasmtech/workspaces-core-images/blob/release/1.18.0/dockerfile-kasm-core)
- [Kasm Firefox startup source](https://github.com/kasmtech/workspaces-images/blob/release/1.18.0/src/ubuntu/install/firefox/custom_startup.sh)
- [Firefox ExtensionSettings reference](https://mozilla.github.io/enterprise-admin-reference/reference/policies/extensionsettings/)
- [Firefox native managed-storage manifests](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests)
- [Firefox storage.managed and restart behavior](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/managed)
- [Docker native Compose secret sources](https://docs.docker.com/reference/compose-file/secrets/)
- [Docker secret targets and ownership](https://docs.docker.com/reference/compose-file/container-spec/)
- [Docker environment-backed secret implementation](https://github.com/docker/compose/blob/main/pkg/compose/secrets.go)
- [Coolify Compose raw deployment mode](https://coolify.io/docs/applications/builds/docker-compose)
- [Coolify application update fields](https://coolify.io/docs/api/endpoints/applications/update-application-by-uuid)
- [Coolify vault references and secret-manager API](https://coolify.io/docs/integrations/security/using-secret-managers)
- [Traefik path matching and route priorities](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/)

These primary sources establish supported mechanisms; they do not prove the
installed server versions, the current image digest, an AMO approval, the live
router state or any acceptance result. The live preflight and deployed
acceptance checks resolve those uncertainties.
