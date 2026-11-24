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
