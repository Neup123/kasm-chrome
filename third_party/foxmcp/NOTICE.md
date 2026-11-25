# FoxMCP adaptation provenance

- Upstream: <https://github.com/ThinkerYzu/foxmcp>
- Commit: `cc97d6ae90a9cd2a7bdeb9e38feaf9d29c395921` (2026-11-12)
- License: MIT; retained in [LICENSE](LICENSE) and packaged in `extension/LICENSE`.
- Source files inspected: `extension/manifest.json`, `extension/background.js`,
  `extension/content.js`, `extension/config.js`, `docs/protocol.md`.

The companion is a reduced adaptation of the upstream persistent WebSocket
background and content-message dispatch. It retains the single-socket ownership
pattern and stale-socket callbacks guard; the packaged `extractText` operation
still obtains `document.body.innerText`. Its wire protocol, authentication,
managed configuration, origin/container guards, fixed probes, bounded retries,
and DOM input operations are specific to this project.

Upstream's broad host permissions, history/bookmark/clipboard/network-monitoring
features, multiple-profile routing, arbitrary script evaluation, options UI,
and content payload logging are excluded.

This is a source adaptation with attribution, not a claim that the upstream
project reviewed or supports this deployment.
