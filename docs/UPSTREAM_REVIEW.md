# Source selection and references

Research date: 2026-11-22. The existing repository had only a Compose file,
with no reusable driver, extension or project-specific skill. Relevant available
engineering, evidence, authority, GitHub and collaboration skills were read.
The existing skill catalog did not contain this Kasm/Firefox automation build.

The implementation search covered GitHub and Mozilla's add-on directory using
queries for Firefox WebExtension remote control, WebSocket automation,
contextual identities, persistent MV2 and browser-agent bridges.

| Candidate | Decision and reason |
| --- | --- |
| [ThinkerYzu/foxmcp](https://github.com/ThinkerYzu/foxmcp) | Adapt selected persistent background/socket and content-dispatch patterns; already MV2/container-aware, but broad permissions and profile/script features must be excluded |
| [mikesmullin/mcp-zen](https://github.com/mikesmullin/mcp-zen) | Broader MCP surface and optional all-URL permission/UI; more scope to remove |
| [SDpower/browse-pilot-cli](https://github.com/SDpower/browse-pilot-cli) | Useful comparable MV2/WS design, but a Go/multi-browser/native-messaging stack and a broader command surface |
| [1jehuang/firefox-agent-bridge](https://github.com/1jehuang/firefox-agent-bridge) | Firefox path uses native messaging, rather than the specified direct outbound WS |
| [korchasa/foxcode](https://github.com/korchasa/foxcode) | Broad permission and arbitrary code execution unsuitable for the narrow signed companion |

The driver reuses Node HTTP and the maintained [ws](https://github.com/websockets/ws)
transport instead of implementing WebSocket framing. Packaging/signing uses
Mozilla [web-ext](https://github.com/mozilla/web-ext). The adaptation is credited
in [the provenance notice](../third_party/foxmcp/NOTICE.md); its MIT license is
retained. No full upstream package or unused browser features are bundled.

## Primary technical sources

- [Mozilla contextual identities](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/contextualIdentities)
- [Mozilla MV2 script injection](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/executeScript)
- [Native managed-storage manifests](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests)
- [Firefox policy reference](https://mozilla.github.io/policy-templates/)
- [Signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [AMO policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- [web-ext commands](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Kasm managed policies](https://docs.kasm.com/docs/latest/how-to/workspaces-sessions/container-workspace/chrome-managed-policies)
- [Kasm 1.18 base entrypoint](https://github.com/kasmtech/workspaces-core-images/blob/release/1.18.0/dockerfile-kasm-core)
- [Docker Compose secrets](https://docs.docker.com/reference/compose-file/secrets/)
- [Coolify application update API](https://coolify.io/docs/api/endpoints/applications/update-application-by-uuid)

Documentation establishes supported mechanisms. The verification report
separately records which mechanisms were actually exercised in this build.
