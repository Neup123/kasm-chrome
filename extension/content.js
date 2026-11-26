/*
 * Packaged DOM operations adapted from FoxMCP content-message dispatch.
 * Copyright (c) 2024 FoxMCP Project; MIT (see LICENSE).
 * All executable operations are in this file. Messages carry data only.
 */
(() => {
  "use strict";

  function createContentExecutor({ window: win, document: doc, protocol, extensionId, documentToken, now = Date.now }) {
    class ContentError extends Error {
      constructor(code, message) { super(message); this.code = code; }
    }
    const fail = (code, message) => { throw new ContentError(code, message); };

    function guard(message) {
      if (message.documentToken !== documentToken || message.expectedUrl !== win.location.href) {
        fail("TARGET_CHANGED", "The target document changed before the operation.");
      }
      if (!protocol.isAllowedUrl(win.location.href)) fail("URL_FORBIDDEN", "This origin is outside the allowed automation scope.");
      if (!Number.isFinite(message.command.deadline) || now() >= message.command.deadline) {
        fail("COMMAND_EXPIRED", "The command deadline has expired; inspect the page before retrying.");
      }
    }

    function selectOne(selector) {
      let elements;
      try { elements = doc.querySelectorAll(selector); }
      catch (_) { fail("INVALID_SELECTOR", "The CSS selector is invalid."); }
      if (elements.length === 0) fail("ELEMENT_NOT_FOUND", "The CSS selector did not match an element.");
      if (elements.length !== 1) fail("ELEMENT_AMBIGUOUS", "The CSS selector matched more than one element.");
      return elements[0];
    }

    function checkInteractable(element) {
      if (!element.isConnected) fail("ELEMENT_DETACHED", "The matched element is no longer in the document.");
      const style = win.getComputedStyle(element);
      if (!element.getClientRects().length || style.display === "none" || style.visibility === "hidden"
        || style.visibility === "collapse" || element.closest('[hidden],[inert],[aria-hidden="true"]')) {
        fail("ELEMENT_HIDDEN", "The matched element is not visible.");
      }
      if (element.disabled || element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") {
        fail("ELEMENT_DISABLED", "The matched element is disabled.");
      }
    }

    function sensitiveField(element) {
      return element.matches('input[type="password"],input[type="file"]')
        || /(^|\s)(current-password|new-password|one-time-code|username)(\s|$)/i.test(element.getAttribute("autocomplete") || "");
    }

    function editable(element) {
      if (sensitiveField(element)) fail("CREDENTIAL_INPUT_FORBIDDEN", "Credential and file inputs are outside this driver's automation scope.");
      if (element.readOnly) fail("ELEMENT_READ_ONLY", "The matched field is read-only.");
      if (element instanceof win.HTMLTextAreaElement) return "textarea";
      if (element instanceof win.HTMLInputElement && /^(text|search|url|email|tel|number)$/.test(element.type)) return "input";
      if (element.isContentEditable || element.getAttribute("contenteditable") === "true"
        || element.getAttribute("contenteditable") === "plaintext-only") return "contenteditable";
      fail("ELEMENT_NOT_EDITABLE", "The matched element is not an editable text field.");
    }

    function textOf(element) {
      return typeof element.innerText === "string" ? element.innerText : (element.textContent || "");
    }

    function describe(element) {
      const result = {
        tag: element.tagName.toLowerCase(), id: element.id || "",
        role: element.getAttribute("role"), type: element.getAttribute("type"),
        ariaLabel: (element.getAttribute("aria-label") || "").slice(0,1000),
        placeholder: (element.getAttribute("placeholder") || "").slice(0,1000),
        disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
        contentEditable: Boolean(element.isContentEditable || /^(true|plaintext-only)$/.test(element.getAttribute("contenteditable") || "")),
        text: textOf(element).slice(0,1000)
      };
      if (!sensitiveField(element) && (element instanceof win.HTMLInputElement || element instanceof win.HTMLTextAreaElement)) {
        result.value = element.value.slice(0, protocol.LIMITS.maxTextLength);
      }
      return result;
    }

    function readText(request) {
      const element = request.selector ? selectOne(request.selector) : doc.body;
      const text = element ? textOf(element) : "";
      const maximum = request.maxLength || protocol.LIMITS.maxReadTextLength;
      return { text: text.slice(0, maximum), truncated: text.length > maximum, totalLength: text.length, url: win.location.href };
    }

    function probe(request) {
      if ("code" in request || "script" in request || "expression" in request) {
        fail("REMOTE_CODE_FORBIDDEN", "Only packaged read-only probes are supported; arbitrary JavaScript is forbidden.");
      }
      switch (request.probe) {
        case "page":
          return { url: win.location.href, title: doc.title.slice(0,1024), readyState: doc.readyState, bodyTextLength: doc.body ? textOf(doc.body).length : 0 };
        case "elements":
          return describe(selectOne(request.selector));
        case "storage": {
          if (win.location.origin !== "http://driver:8080") fail("PROBE_FORBIDDEN", "Storage probes are limited to the internal placeholder pages.");
          const value = win.localStorage.getItem("kasm_probe");
          if (value !== null && value.length > 4096) fail("PROBE_VALUE_TOO_LONG", "A placeholder storage value exceeds the probe limit.");
          return { localStorage: { kasm_probe: value } };
        }
        default:
          fail("UNKNOWN_PROBE", "The requested packaged probe does not exist.");
      }
    }

    function click(request, message) {
      const element = selectOne(request.selector);
      checkInteractable(element);
      if (typeof element.click !== "function") fail("ELEMENT_NOT_CLICKABLE", "The matched element has no DOM click method.");
      const matched = describe(element);
      guard(message);
      element.click();
      return { clicked: true, matched };
    }

    async function type(request, message) {
      const element = selectOne(request.selector);
      checkInteractable(element);
      const kind = editable(element);
      const current = kind === "contenteditable" ? textOf(element) : element.value;
      const value = request.clear === false ? current + request.text : request.text;
      if (value.length > protocol.LIMITS.maxTextLength) fail("TEXT_TOO_LONG", "The resulting field content exceeds the configured limit.");
      element.focus({ preventScroll: true });
      guard(message);
      let method;
      if (kind === "contenteditable") {
        const selection = win.getSelection();
        const range = doc.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        let inserted = false;
        if (typeof doc.execCommand === "function") {
          // Native editing integrates with rich text editors and their history.
          // It does not synthesize mouse/keyboard or press Enter.
          try { inserted = doc.execCommand("insertText", false, value); }
          catch (_) { inserted = false; }
        }
        if (!inserted) element.textContent = value;
        method = inserted ? "contenteditable-insertText" : "contenteditable-dom-input";
      } else {
        const prototype = kind === "textarea" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (!setter) fail("VALUE_SETTER_UNAVAILABLE", "The browser's native field value setter is unavailable.");
        setter.call(element, value);
        method = "native-value-setter";
      }
      element.dispatchEvent(new win.InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: request.text }));
      element.dispatchEvent(new win.Event("change", { bubbles: true }));
      // Let editor MutationObservers settle, without retrying or resubmitting.
      await new Promise(resolve => win.setTimeout(resolve, 0));
      guard(message);
      const currentElement = selectOne(request.selector);
      const actual = kind === "contenteditable" ? textOf(currentElement) : currentElement.value;
      if (actual !== value) fail("TYPE_NOT_APPLIED", "The page did not retain the requested field text; no send action was performed.");
      return { value: actual, length: actual.length, method };
    }


    // ChatGPT-specific writes never run on the internal HTTP fixture.
    function chatOnly() {
      if (win.location.origin !== "https://chatgpt.com") fail("URL_FORBIDDEN", "This command is restricted to ChatGPT.");
    }
    const normalized = value => value.replace(/\s+/g, " ").trim();
    const visible = element => {
      try { checkInteractable(element); return true; } catch (_) { return false; }
    };
    const matches = (root, selector) => Array.from(root.querySelectorAll(selector)).filter(visible);
    function unique(items, code, detail) {
      if (items.length !== 1) fail(code, detail);
      return items[0];
    }
    async function waitFor(message, lookup, code, detail) {
      // Bound waits even when the caller requests the maximum transport timeout.
      const until = Math.min(message.command.deadline, now() + 1800);
      for (let attempt = 0; attempt < 36; attempt++) {
        guard(message);
        const value = lookup();
        if (value) return value;
        if (now() >= until) break;
        await new Promise(resolve => win.setTimeout(resolve, 50));
      }
      fail(code, detail);
    }
    const effortLabel = button => {
      const text = normalized(textOf(button) + " " + (button.getAttribute("aria-label") || ""));
      const levels = protocol.EFFORTS.filter(level => new RegExp("\\b" + level + "\\b", "i").test(text));
      return levels.length === 1 ? levels[0] : null;
    };
    function effortButton() {
      const composer = doc.querySelector("#prompt-textarea");
      const root = composer?.closest("form") || composer?.closest('[data-testid="composer"]');
      if (!root) fail("EFFORT_COMPOSER_NOT_FOUND", "The ChatGPT composer could not be uniquely identified.");
      const candidates = matches(root, "button").filter(button => {
        const name = normalized((button.getAttribute("aria-label") || "") + " " + (button.getAttribute("data-testid") || "") + " " + textOf(button));
        return /effort|thinking/i.test(name) && (effortLabel(button) || /effort/i.test(name));
      });
      // Some composers expose only the current level as the button's label.
      const exact = candidates.length ? candidates : matches(root, "button").filter(button =>
        protocol.EFFORTS.includes(normalized(textOf(button))) || protocol.EFFORTS.includes(button.getAttribute("aria-label")));
      return unique(exact, "EFFORT_PICKER_NOT_UNIQUE", "No unique thinking-effort control was found in the composer.");
    }
    function effortPopup() {
      const roots = matches(doc, '[data-state="open"],[role="dialog"],[role="menu"],[data-radix-popper-content-wrapper]');
      const found = roots.filter(root => protocol.EFFORTS.every(level =>
        Array.from(root.querySelectorAll("*")).some(el => !el.children.length && normalized(textOf(el)) === level && visible(el))));
      const innermost = found.filter(root => !found.some(other => other !== root && root.contains(other)));
      if (innermost.length > 1) fail("EFFORT_PICKER_AMBIGUOUS", "Multiple open effort pickers matched.");
      return innermost[0];
    }
    function pointer(target, type, x, y, down) {
      const EventClass = win.PointerEvent;
      if (typeof EventClass !== "function") fail("POINTER_UNAVAILABLE", "This browser cannot dispatch packaged pointer events.");
      target.dispatchEvent(new EventClass(type, {
        bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y,
        pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: down ? 1 : 0
      }));
    }
    function effortGeometry(root, current, desired) {
      const labels = protocol.EFFORTS.map(level => unique(Array.from(root.querySelectorAll("*")).filter(el =>
        !el.children.length && normalized(textOf(el)) === level && visible(el)), "EFFORT_TICKS_NOT_UNIQUE", "The three effort ticks were not uniquely identified."));
      const rects = labels.map(el => el.getBoundingClientRect());
      const xs = rects.map(r => r.left + r.width / 2);
      if (!(xs[0] < xs[1] && xs[1] < xs[2])) fail("EFFORT_GEOMETRY_UNVERIFIED", "The three effort ticks do not form the expected horizontal sequence.");
      const labelTop = Math.min(...rects.map(r => r.top));
      // Track may have no slider role. Use a visible narrow horizontal track
      // spanning the three labels, immediately above their row; refuse ties.
      const candidates = matches(root, 'div,span,input[type="range"],[role="slider"]').map(el => ({el,r:el.getBoundingClientRect()}))
        .filter(({r}) => r.width >= (xs[2] - xs[0]) * .8 && r.height > 0 && r.height <= 32 &&
          r.left <= xs[0] + 12 && r.right >= xs[2] - 12 && r.bottom <= labelTop + 3 && labelTop - r.bottom <= 48);
      candidates.sort((a,b) => (labelTop-a.r.bottom)-(labelTop-b.r.bottom) || a.r.height-b.r.height);
      if (!candidates.length) fail("EFFORT_TRACK_NOT_FOUND", "No visible horizontal effort track matches the tick geometry.");
      const {el, r} = candidates[0];
      if (candidates.length > 1 && candidates[1].r.bottom === r.bottom && candidates[1].r.height === r.height &&
        !el.contains(candidates[1].el) && !candidates[1].el.contains(el))
        fail("EFFORT_TRACK_AMBIGUOUS", "Multiple unrelated tracks match the effort ticks.");
      const index = level => protocol.EFFORTS.indexOf(level);
      const tickX = level => Math.max(r.left + 1, Math.min(r.right - 1, xs[index(level)]));
      return {el, y:r.top+r.height/2, from:tickX(current), to:tickX(desired)};
    }
    async function setEffort(request, message) {
      chatOnly();
      const trigger = effortButton();
      const previous = effortLabel(trigger);
      if (previous === request.effort) return {effort:previous, changed:false, verified:true};
      if (!previous) fail("EFFORT_CURRENT_UNKNOWN", "The composer does not identify its current Low, Medium, or High effort.");
      let popup = effortPopup();
      if (!popup) {
        guard(message); trigger.click();
        popup = await waitFor(message, effortPopup, "EFFORT_PICKER_NOT_OPEN", "The effort popup did not open.");
      }
      const {el,y,from,to} = effortGeometry(popup, previous, request.effort);
      // Dispatch to the actual hit-tested child (usually the draggable thumb),
      // then to the same target for pointermove/up; no browser-wide input.
      const hit = typeof doc.elementFromPoint === "function" ? doc.elementFromPoint(from,y) : el;
      const target = hit && (hit === el || el.contains(hit)) ? hit : el;
      checkInteractable(target);
      guard(message); pointer(target,"pointerdown",from,y,true);
      try {
        for (let step=1; step<=4; step++) {
          guard(message);
          pointer(target,"pointermove",from+(to-from)*step/4,y,true);
        }
      } finally {
        pointer(target,"pointerup",to,y,false);
      }
      await waitFor(message, () => {
        try { return effortLabel(effortButton()) === request.effort; } catch (_) { return false; }
      }, "EFFORT_NOT_APPLIED", "The composer label did not confirm the requested effort; inspect before retrying.");
      return {effort:request.effort, previous, changed:true, verified:true};
    }
    function approval() {
      const forms = matches(doc, "form").filter(form => matches(form, 'button[aria-label="Approval options"]').length);
      if (!forms.length) return null;
      const form = unique(forms,"APPROVAL_AMBIGUOUS","Multiple approval forms are open.");
      const trigger = unique(matches(form,'button[aria-label="Approval options"]'),"APPROVAL_AMBIGUOUS","Approval options are ambiguous.");
      // The alert and form are siblings, not a dialog role. Walk only their
      // local ancestors and require exactly one preceding visible alert.
      let root = form.parentElement;
      let alert;
      while (root && root !== doc.body) {
        const candidates = matches(root,'[role="alert"]').filter(el => el.compareDocumentPosition(form) & win.Node.DOCUMENT_POSITION_FOLLOWING);
        if (candidates.length > 1) fail("APPROVAL_AMBIGUOUS","Multiple preceding approval alerts matched.");
        if (candidates.length === 1) { alert = candidates[0]; break; }
        root = root.parentElement;
      }
      if (!alert) fail("APPROVAL_TEXT_NOT_FOUND","The approval form has no uniquely associated preceding alert.");
      const leaves = Array.from(alert.querySelectorAll("*")).filter(el => !el.children.length && visible(el));
      const questionCandidates = leaves.filter(el => /^Allow ChatGPT to use .+\??$/i.test(normalized(textOf(el))));
      const q = questionCandidates.length === 1 ? questionCandidates[0] : (!alert.children.length && /^Allow ChatGPT to use .+\??$/i.test(normalized(textOf(alert))) ? alert : null);
      if (!q) fail("APPROVAL_TEXT_NOT_FOUND","The approval question could not be isolated.");
      const question = textOf(q).trim();
      const description = leaves.filter(el=>el!==q).map(el=>textOf(el).trim()).filter(Boolean).join("\n");
      if (!description) fail("APPROVAL_TEXT_NOT_FOUND","The approval description could not be isolated.");
      if (question.length + description.length > 16000) fail("APPROVAL_TEXT_TOO_LONG","Approval text exceeds the safe response limit.");
      return {form,trigger,question,description};
    }
    async function approve(request,message) {
      chatOnly();
      const initial = approval();
      if (!initial) return {found:false,approved:false};
      const {question,description} = initial;
      // No service supplied: read the question, without opening or granting.
      if (!request.service) return {found:true,approved:false,question,description};
      const expected = "Allow ChatGPT to use " + request.service;
      if (![expected,expected+"?"].includes(normalized(question)))
        fail("APPROVAL_SERVICE_MISMATCH","The open question does not match the explicitly requested service.");
      const menus = () => matches(doc,'[role="menu"][data-state="open"]');
      if (menus().length) fail("APPROVAL_MENU_ALREADY_OPEN","Inspect and close the existing menu before authorizing.");
      guard(message); initial.trigger.click();
      const menu = await waitFor(message, () => {
        const items = menus();
        if (items.length > 1) fail("APPROVAL_MENU_AMBIGUOUS","Multiple menus are open.");
        return items[0];
      },"APPROVAL_MENU_NOT_OPEN","Approval options did not open.");
      const current = approval();
      if (!current || current.form !== initial.form || current.question !== question || current.description !== description)
        fail("APPROVAL_CHANGED","The approval prompt changed before the grant.");
      const items = matches(menu,'[role="menuitem"]');
      const full = "Allow " + request.service + " for this conversation";
      // The expected item is second, but its label must independently match.
      if (items.length < 2 || normalized(textOf(items[1])) !== full ||
          items.filter(item=>normalized(textOf(item)) === full).length !== 1)
        fail("APPROVAL_OPTION_NOT_VERIFIED","The full-conversation menu item was not verified. No grant was activated.");
      guard(message); items[1].click();
      await waitFor(message, () => !initial.form.isConnected || !visible(initial.trigger), "APPROVAL_NOT_CONFIRMED",
        "The grant was activated but the approval form did not disappear; inspect before retrying.");
      return {found:true,approved:true,scope:"conversation",question,description,service:request.service};
    }
    function key(request,message) {
      // The internal fixture is allowed only for synthetic key-event smoke
      // tests; ChatGPT is the only external origin already permitted by guard.
      const target = doc.activeElement || doc.body;
      checkInteractable(target);
      if (sensitiveField(target)) fail("CREDENTIAL_INPUT_FORBIDDEN","Credential inputs are outside keyboard scope.");
      const parts = request.key.split("+");
      const raw = parts.pop();
      const letter = /^[A-Z]$/.test(raw);
      const keyValue = letter && !parts.includes("Shift") ? raw.toLowerCase() : raw;
      const code = letter ? "Key"+raw : /^[0-9]$/.test(raw) ? "Digit"+raw : raw;
      const options = {key:keyValue,code,ctrlKey:parts.includes("Ctrl"),shiftKey:parts.includes("Shift"),
        altKey:parts.includes("Alt"),metaKey:parts.includes("Meta"),bubbles:true,cancelable:true,composed:true};
      guard(message);
      const down = new win.KeyboardEvent("keydown",options);
      const accepted = target.dispatchEvent(down);
      // Always release on the same target; do not retarget after an event.
      target.dispatchEvent(new win.KeyboardEvent("keyup",options));
      return {dispatched:true,key:request.key,defaultPrevented:!accepted,synthetic:true};
    }

    async function handle(message, sender) {
      if (message?.kind !== "kasm-agent-dom-v1") return undefined;
      if (sender?.id !== extensionId || sender.tab) {
        return { ok: false, error: { code: "SENDER_FORBIDDEN", message: "Only this extension's background page may send DOM commands." } };
      }
      try {
        guard(message);
        const request = protocol.validateCommand(message.command);
        let result;
        switch (request.cmd) {
          case "tabs.readText": result = readText(request); break;
          case "tabs.eval": result = probe(request); break;
          case "tabs.click": result = click(request, message); break;
          case "tabs.type": result = await type(request, message); break;
          case "tabs.setEffort": result = await setEffort(request, message); break;
          case "tabs.approve": result = await approve(request, message); break;
          case "tabs.key": result = key(request, message); break;
          default: fail("UNKNOWN_DOM_COMMAND", "This command is not a packaged DOM operation.");
        }
        return { ok: true, result };
      } catch (error) {
        return { ok: false, error: {
          code: typeof error?.code === "string" ? error.code : "DOM_ACTION_FAILED",
          message: typeof error?.code === "string" ? error.message : "The DOM operation failed; inspect the current page before retrying."
        } };
      }
    }

    return Object.freeze({ handle });
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { createContentExecutor };
    return;
  }
  if (globalThis.__KASM_AGENT_DOCUMENT__) return {
    documentToken: globalThis.__KASM_AGENT_DOCUMENT__.binding.documentToken,
    url: window.location.href
  };
  // The private HTTP fixture is not a secure context in Firefox.
  // getRandomValues is supported there and keeps a 128-bit per-document token.
  const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
  const documentToken = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const binding = Object.freeze({ documentToken, url: window.location.href });
  const executor = createContentExecutor({ window, document, protocol: globalThis.KasmProtocol, extensionId: browser.runtime.id, documentToken: binding.documentToken });
  browser.runtime.onMessage.addListener(executor.handle);
  Object.defineProperty(globalThis, "__KASM_AGENT_DOCUMENT__", { value: { binding }, configurable: false });
  return binding;
})();
