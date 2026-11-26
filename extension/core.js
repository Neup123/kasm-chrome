/*
 * Adapted from FoxMCP, Copyright (c) 2024 FoxMCP Project (MIT).
 * Scoped routing and document binding are specific to this companion.
 * See LICENSE and ../third_party/foxmcp/NOTICE.md for provenance.
 */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KasmAgentCore = api;
})(globalThis, function createCoreModule() {
  "use strict";

  class AgentError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "AgentError";
      this.code = code;
    }
  }

  const safeError = (error) => ({
    code: typeof error?.code === "string" ? error.code : "BROWSER_OPERATION_FAILED",
    message: typeof error?.code === "string" ? error.message : "The browser operation failed; refresh the tab inventory before retrying."
  });

  function createRouter(browser, protocol, { now = Date.now } = {}) {
    let queue = Promise.resolve();
    let queued = 0;

    function requireLive(request, isCurrent) {
      if (!isCurrent()) throw new AgentError("CONNECTION_CHANGED", "The originating driver connection is no longer active.");
      if (!Number.isFinite(request.deadline) || now() >= request.deadline) {
        throw new AgentError("COMMAND_EXPIRED", "The command deadline has expired; no new action was started.");
      }
    }

    function allowedUrl(value) {
      if (!protocol.isAllowedUrl(value)) throw new AgentError("URL_FORBIDDEN", "Only the configured ChatGPT and internal driver origins are allowed.");
      return value;
    }

    function identityResult(identity) {
      return { name: identity.name, cookieStoreId: identity.cookieStoreId, color: identity.color, icon: identity.icon };
    }

    async function findIdentity(name, { allowMissing = false } = {}) {
      const matches = (await browser.contextualIdentities.query({ name })).filter(identity => identity.name === name);
      if (matches.length > 1) throw new AgentError("CONTAINER_AMBIGUOUS", "More than one Firefox container has that exact name.");
      if (!matches.length) {
        if (allowMissing) return null;
        throw new AgentError("CONTAINER_NOT_FOUND", "The named Firefox container does not exist; call containers.ensure first.");
      }
      if (!/^firefox-container-[1-9]\d*$/.test(matches[0].cookieStoreId)) {
        throw new AgentError("CONTAINER_FORBIDDEN", "A regular named Firefox container is required.");
      }
      return matches[0];
    }

    async function targetTab(request, identity) {
      let tab;
      try { tab = await browser.tabs.get(request.tabId); }
      catch (_) { throw new AgentError("TAB_NOT_FOUND", "The requested tab is unavailable; refresh tabs.list."); }
      if (tab.cookieStoreId !== identity.cookieStoreId) {
        throw new AgentError("CONTAINER_MISMATCH", "The tab does not belong to the requested named container.");
      }
      allowedUrl(tab.url);
      // A pending navigation must never authorize an action in the old document.
      if (tab.pendingUrl && tab.pendingUrl !== tab.url) {
        throw new AgentError("TARGET_CHANGED", "The tab is navigating; wait for it to finish before acting.");
      }
      return tab;
    }

    function tabResult(tab, identity) {
      return {
        tabId: tab.id, container: identity.name, cookieStoreId: identity.cookieStoreId,
        url: tab.url, title: tab.title || "", active: Boolean(tab.active), status: tab.status
      };
    }

    async function domCommand(request, identity, isCurrent) {
      const before = await targetTab(request, identity);
      requireLive(request, isCurrent);
      await browser.tabs.executeScript(before.id, { file: "/protocol.js", frameId: 0, runAt: "document_idle" });
      requireLive(request, isCurrent);
      const injected = await browser.tabs.executeScript(before.id, { file: "/content.js", frameId: 0, runAt: "document_idle" });
      const binding = injected?.[0];
      if (!binding || typeof binding.documentToken !== "string" || binding.url !== before.url) {
        throw new AgentError("TARGET_CHANGED", "The document changed while the content script was loading.");
      }
      const current = await targetTab(request, identity);
      if (current.url !== before.url) throw new AgentError("TARGET_CHANGED", "The tab URL changed before the action.");
      requireLive(request, isCurrent);
      let response;
      try {
        response = await browser.tabs.sendMessage(before.id, {
          kind: "kasm-agent-dom-v1", documentToken: binding.documentToken,
          expectedUrl: before.url, command: request
        }, { frameId: 0 });
      } catch (_) {
        throw new AgentError("DOCUMENT_UNAVAILABLE", "The target document no longer accepts messages; inspect the page before retrying.");
      }
      if (!response || typeof response.ok !== "boolean") throw new AgentError("INVALID_CONTENT_RESPONSE", "The content script did not return a valid reply.");
      if (!response.ok) throw new AgentError(response.error?.code || "DOM_ACTION_FAILED", response.error?.message || "The DOM action failed.");
      return response.result;
    }

    async function execute(request, isCurrent) {
      requireLive(request, isCurrent);
      if (request.cmd === "containers.list") {
        return (await browser.contextualIdentities.query({})).map(identityResult);
      }
      if (request.cmd === "containers.ensure") {
        let identity = await findIdentity(request.container, { allowMissing: true });
        requireLive(request, isCurrent);
        if (!identity) {
          identity = await browser.contextualIdentities.create({
            name: request.container, color: request.color || "blue", icon: request.icon || "fingerprint"
          });
        } else {
          const update = {};
          if (request.color && request.color !== identity.color) update.color = request.color;
          if (request.icon && request.icon !== identity.icon) update.icon = request.icon;
          if (Object.keys(update).length) identity = await browser.contextualIdentities.update(identity.cookieStoreId, update);
        }
        return identityResult(identity);
      }
      const identity = await findIdentity(request.container);
      requireLive(request, isCurrent);
      switch (request.cmd) {
        case "tabs.list": {
          const tabs = await browser.tabs.query({ cookieStoreId: identity.cookieStoreId });
          return tabs.filter(tab => tab.cookieStoreId === identity.cookieStoreId && protocol.isAllowedUrl(tab.url))
            .map(tab => tabResult(tab, identity));
        }
        case "tabs.create": {
          allowedUrl(request.url);
          const tab = await browser.tabs.create({ url: request.url, cookieStoreId: identity.cookieStoreId, active: request.active !== false });
          return tabResult({ ...tab, url: tab.url || request.url }, identity);
        }
        case "tabs.navigate": {
          await targetTab(request, identity);
          allowedUrl(request.url);
          requireLive(request, isCurrent);
          const tab = await browser.tabs.update(request.tabId, { url: request.url });
          return tabResult(tab, identity);
        }
        case "tabs.close": {
          await targetTab(request, identity);
          requireLive(request, isCurrent);
          await browser.tabs.remove(request.tabId);
          return { tabId: request.tabId, closed: true };
        }
        case "tabs.readText":
        case "tabs.eval":
        case "tabs.click":
        case "tabs.type":
        case "tabs.setEffort":
        case "tabs.approve":
        case "tabs.key":
          return domCommand(request, identity, isCurrent);
        default:
          throw new AgentError("UNKNOWN_COMMAND", "The extension does not support this command.");
      }
    }

    function dispatch(raw, { isCurrent = () => true } = {}) {
      let request;
      try { request = protocol.validateCommand(raw); }
      catch (error) { return Promise.reject(error); }
      if (queued >= protocol.LIMITS.maxQueue) return Promise.reject(new AgentError("QUEUE_FULL", "The browser command queue is full."));
      queued++;
      const result = queue.then(() => execute(request, isCurrent));
      queue = result.catch(() => {}).finally(() => { queued--; });
      return result;
    }

    return Object.freeze({ dispatch });
  }

  return Object.freeze({ createRouter, AgentError, safeError });
});
