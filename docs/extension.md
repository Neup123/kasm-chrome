# Firefox companion extension

## Scope

`kasm-agent@chabad.gr` is a Manifest V2 extension with a persistent background
page. It uses one Firefox instance and named contextual identities. It does not
create profiles, invoke a debugging protocol, or automate login.

The only host permissions are `https://chatgpt.com/*` and `http://driver/*`.
Firefox host match patterns do not constrain ports, so runtime checks restrict
the second origin to `http://driver:8080`. Container names are exact and
case-sensitive. A duplicate name is an error, never an arbitrary choice.

The extension adapts FoxMCP's persistent WebSocket connection ownership,
stale-socket guards, and packaged content-message dispatch. See
[provenance](../third_party/foxmcp/NOTICE.md).

## Connection state transitions

All connection-state writes go through one transition function. No request is
replayed on reconnection.

| Current state | Event | Next state | Side effects |
|---|---|---|---|
| `initializing` | Managed configuration is valid | `connecting` | Open one authenticated WebSocket |
| `initializing` | Configuration missing or invalid | `blocked` | Log an error code only; await Firefox restart |
| `connecting` | WebSocket opens | `connected` | Reset retry delay; send extension handshake |
| `connecting` | Error, close, or connection timeout | `waiting` | Close/invalidate socket; schedule bounded backoff |
| `connected` | WebSocket closes | `waiting` | Invalidate socket; fail stale queued actions; schedule backoff |
| `waiting` | Retry timer fires | `connecting` | Open one replacement socket |
| Any nonterminal state | Extension is stopped | `stopped` | Cancel timers and close the socket |

`blocked` and `stopped` are terminal for that background-page lifetime. Managed
storage changes require Firefox restart. Backoff starts at one second and caps
at thirty seconds, with jitter. Browser WebSocket handles server ping/pong.

## Managed configuration

`browser.storage.managed.get()` must return:

```json
{
  "wsUrl": "ws://driver:8080/ws",
  "wsToken": "<supplied by the secure runtime secret mechanism>"
}
```

The URL is fixed, and tokens must contain at least 43 characters. The token is
never part of the XPI, image, source, browser page, or extension logs. The
extension adds it as the WebSocket `token` query parameter. Do not enable
WebSocket request-URL logging.

Firefox's supported native managed-storage mechanism can provide this object
from `/usr/lib/mozilla/managed-storage/kasm-agent@chabad.gr.json`. That runtime
file wraps it as `{name, description, type: "storage", data: {...}}`. An
enterprise `3rdparty` policy is another supported provisioning mechanism.

## Safe script execution

The background page injects the packaged `content.js` file, receives a unique
document token, checks the tab/container/origin again, and then sends a fixed
operation to that document. The listener checks the sender, document token,
current URL, origin, and request deadline before acting. An intervening
navigation fails rather than performing an action in the wrong document.

Incoming WebSocket messages and serialized replies are bounded by their UTF-8
byte length. An oversized reply returns `RESULT_TOO_LARGE`, so an agent can
request a smaller text selection without replaying the preceding operation.
`tabs.eval` with `probe: "storage"` reads only `localStorage.kasm_probe` on the
internal fixture origin; it never returns cookies or other storage entries.

CSS selectors must match exactly one element. Clicks call the verified DOM
element's `.click()` method. Typing into inputs and textareas uses their native
value setter and dispatches input/change events. Contenteditable fields use an
editable selection and `insertText`, with a DOM/event fallback. Typing is
verified against the resulting field value; it does not itself submit a form.
Use a separate `tabs.click` on the verified send button to submit.

`tabs.eval` is deliberately a set of packaged read-only probes, not arbitrary
JavaScript execution. A `code`, `script`, or `expression` argument fails with
`REMOTE_CODE_FORBIDDEN`. This keeps executable code inside the signed XPI.
Mozilla signing/review acceptance remains an external verification gate.

## Verification boundaries

Unit tests exercise routing, container isolation, duplicate names, stale
documents, deadlines, selectors, typing, and WebSocket reconnection. Mocked
WebExtension APIs and a DOM test environment do not prove AMO signing, Firefox
enterprise installation, Kasm startup, actual ChatGPT composer behavior, or
Traefik/Authelia configuration. Those require the live acceptance run.

## Official references

- [Persistent background pages](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [Contextual identities and required permissions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/contextualIdentities)
- [Host permissions and tab metadata](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions)
- [Packaged script injection](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/executeScript)
- [Managed-storage manifest format and Linux path](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests)
- [Managed storage requires restart](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/managed)
- [Mozilla add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- [Data collection declarations](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)

References checked on 2026-11-22.

### Conversation controls (0.1.2)
 
All use the existing named container, tab ID, document token, deadline and replay
guard. No automatic approval or retry occurs. `tabs.setEffort` and
`tabs.approve` are restricted to https://chatgpt.com, not the fixture.
 
- `tabs.setEffort`, `effort: "Low" | "Medium" | "High"`: locate the composer,
  open the effort picker, drag the identified track and verify the composer
  label. No Pro selection. Unknown or ambiguous markup, or a label that does
  not change, fails explicitly.
- `tabs.approve`: omit `service` for read-only inspection, returning
  `found`, exact question and description text, and `approved:false`.
  For a grant, explicitly supply the exact service name (e.g. `"GitHub"`).
  The packaged action matches the question, opens the Approval options menu,
  checks the second item's exact full-conversation label, and verifies that
  the form disappears. It never activates Allow once, guesses a menu item, or
  grants an unrequested service. A timeout after activation is an unknown
  outcome; inspect before retrying. English UI wording is required.
- `tabs.key`, `key: "Escape"`, `"Enter"`, `"ArrowDown"`, or
  `"Ctrl+Shift+M"`: dispatch bounded synthetic keydown/keyup events on the
  target document's focused element. These are not trusted native input,
  cannot invoke browser-level shortcuts or guarantee default browser editing
  or form submission. The result reports dispatch and default prevention,
  not application acceptance. Password/file/credential inputs are excluded.
 
The effort geometry and approval markup are based on reported UI observations
and synthetic fixtures; no claim of real ChatGPT compatibility is made until
a separately authorized, isolated account acceptance check. The existing
signed 0.1.1 artifact remains historical and must not be used to build 0.1.2.

### Viewport inspection and coordinate controls

These three commands are ChatGPT-only. Coordinates are CSS viewport pixels,
not page-scroll offsets or screenshot/device pixels. The map returns up to 150
visible enabled semantic controls (bounded labels/text and bounding rectangles);
it reports truncation and is not a screenshot or guarantee of hitability.
Role-less controls are reachable with point inspection.

- `tabs.mapInteractive`: no extra fields; read-only visible control inventory.
- `tabs.inspectAt`: `x`, `y`; hit-tests with elementFromPoint and returns the
  element plus ancestors (tag, explicit role, ariaLabel, text, rect), viewport
  and an inspectionId. A new inspection supersedes the previous one.
- `tabs.clickAt`: identical `x`, `y`, and the returned `inspectionId`.
  The one-use inspection expires after 30 seconds and is bound to the document,
  URL, exact target, ancestry and geometry. Changed or covered targets fail.
  The action dispatches pointer/mouse events at the inspected point, not a
  center click or native browser input. Inspect the application's response
  before retrying; dispatch does not establish acceptance.

No new host permission, arbitrary code, frame traversal, credential input,
automatic approval, replay or native privileged keyboard/pointer API is added.
Effort drag and approval use the same hit-test primitives; the approval
options trigger is hit near its right edge and the verified conversation
menu item is hit-tested before activation. These are synthetic events
(`isTrusted=false`); isolated real application verification remains required.
