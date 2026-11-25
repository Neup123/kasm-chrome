# AMO reviewer notes

## Purpose and distribution

This is a self-distributed enterprise companion for a single Firefox browser
inside a private container workspace. The administrator installs the signed
XPI with Firefox `ExtensionSettings` and supplies the private driver connection
through Firefox managed storage. The add-on is not a public browsing proxy.

The extension reads page text and performs explicit DOM operations requested by
an authenticated controller. The permitted pages are `https://chatgpt.com/*`
and a private Docker service origin, `http://driver:8080`. Each command must
name an existing Firefox contextual identity; commands never use default-store
tabs. Container creation is explicit through `containers.ensure`.

## Code and data handling

All JavaScript is packaged. The protocol accepts a fixed command set and JSON
data. `tabs.eval` is a compatibility command name for packaged, read-only probes;
it rejects remote JavaScript source. There is no JavaScript `eval`, `Function`
constructor, `userScripts`, remote script loading, or webpage CSP modification.

The add-on makes one outbound WebSocket connection to `ws://driver:8080/ws`.
This DNS name resolves only within the container network on the same host. The
socket and private placeholder HTTP pages are not routed publicly. The
administrator's external controller reaches the driver through HTTPS and a
separate API key. The internal WebSocket additionally requires a long random
token, supplied outside the XPI by managed storage. The browser's token and
page content never appear in logs. The internal transport is plain WebSocket
as required by this deployment design; Mozilla must assess whether this
same-host container boundary meets its remote-transport policy.

Page text, tab URLs, controller-requested input results, and ChatGPT conversation
content may be sent to the private driver. The manifest declares website
content, website activity, browsing activity, and personal communications.
The add-on has no telemetry, analytics, advertising, or third-party data sink.

## Permission rationale

| Permission | Required use |
|---|---|
| `contextualIdentities` and `cookies` | Mozilla requires both to create/query named containers and use their `cookieStoreId`; the add-on does not enumerate login cookies |
| `storage` | Read administrator-provided `storage.managed` connection settings |
| `https://chatgpt.com/*` | Read requested page text and perform fixed DOM operations in named containers |
| `http://driver/*` | Exercise private placeholder pages used for container and DOM verification; runtime origin checks restrict the port to 8080 |

No `tabs` permission is requested. Matching host permissions supply URL/title
metadata only for the allowed origins.

## Build and review

The extension source is unminified plain JavaScript; no compilation or remote
dependencies are needed. `protocol.js` is the shared protocol source also used
by the driver. The package includes the upstream FoxMCP MIT license and the
repository records the exact adaptation provenance. Run the project's tests
and `web-ext lint --self-hosted` before `web-ext sign --channel=unlisted`.

The extension does not log into any website. Any session used during deployment
is created manually by its owner. Verification uses placeholder sessions.

Signing and installation have not been claimed in advance of AMO returning a
signed artifact and the live policy-install acceptance checks.
