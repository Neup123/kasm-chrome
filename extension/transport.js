/*
 * Adapted from FoxMCP, Copyright (c) 2024 FoxMCP Project (MIT).
 * Retains its single-socket ownership and stale-callback protection pattern.
 * See LICENSE and ../third_party/foxmcp/NOTICE.md.
 */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KasmAgentTransport = api;
})(globalThis, function createTransportModule() {
  "use strict";

  const TRANSITIONS = Object.freeze({
    initializing: new Set(["connecting", "waiting", "blocked", "stopped"]),
    connecting: new Set(["connected", "waiting", "blocked", "stopped"]),
    connected: new Set(["waiting", "stopped"]),
    waiting: new Set(["initializing", "connecting", "stopped"]),
    blocked: new Set(),
    stopped: new Set()
  });
  const TERMINAL = new Set(["blocked", "stopped"]);
  // Six startup attempts, with 30 seconds of total delay before exhaustion.
  const STARTUP_RETRY_DELAYS = Object.freeze([1000, 2000, 4000, 8000, 15000]);

  // Firefox Window methods require their native receiver. Storing bare
  // references on the adapter makes timers.setTimeout() throw on first boot.
  const BROWSER_TIMERS = Object.freeze({
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: (id) => globalThis.clearTimeout(id)
  });

  function createConnection({ browser, protocol, router, safeError, WebSocketImpl = WebSocket,
    now = Date.now, random = Math.random, timers = BROWSER_TIMERS, logger = () => {} }) {
    let state = "initializing";
    let socket = null;
    let retryTimer = null;
    let connectTimer = null;
    let attempts = 0;
    let nextRetryAt = null;
    let config;
    let started = false;
    let startupFailures = 0;
    const received = new Map();
    const encoder = new TextEncoder();

    function transition(next) {
      if (!TRANSITIONS[state].has(next)) throw new Error("Invalid extension connection transition");
      state = next;
      logger({ component: "extension", event: state });
    }

    function clearTimers() {
      if (retryTimer !== null) timers.clearTimeout(retryTimer);
      if (connectTimer !== null) timers.clearTimeout(connectTimer);
      retryTimer = null;
      connectTimer = null;
      nextRetryAt = null;
    }

    function invalidateSocket() {
      const previous = socket;
      socket = null; // Late events from the old socket cannot affect its replacement.
      if (previous && previous.readyState !== WebSocketImpl.CLOSED) {
        try { previous.close(1000, "reconnect"); } catch (_) { /* no URL-bearing errors */ }
      }
    }

    function scheduleReconnect() {
      if (TERMINAL.has(state) || state === "waiting") return;
      clearTimers();
      invalidateSocket();
      transition("waiting");
      const base = Math.min(30000, 1000 * (2 ** Math.min(attempts++, 5)));
      const delay = Math.min(30000, Math.max(1000, Math.round(base * (0.75 + random() * 0.5))));
      nextRetryAt = now() + delay;
      retryTimer = timers.setTimeout(() => {
        retryTimer = null;
        nextRetryAt = null;
        if (state === "waiting") connect();
      }, delay);
    }

    // Native exception text can contain a socket URL and its credential.
    // Keep only fixed failure stages, never browser exception fields.
    function scheduleStartupRetry(stage) {
      if (TERMINAL.has(state)) return;
      logger({ component: "extension", error: "STARTUP_ATTEMPT_FAILED", stage });
      clearTimers();
      invalidateSocket();
      config = undefined;
      const retryIndex = startupFailures++;
      if (retryIndex >= STARTUP_RETRY_DELAYS.length) {
        transition("blocked");
        logger({ component: "extension", error: "STARTUP_RETRIES_EXHAUSTED" });
        return;
      }
      transition("waiting");
      const delay = STARTUP_RETRY_DELAYS[retryIndex];
      nextRetryAt = now() + delay;
      retryTimer = timers.setTimeout(() => {
        retryTimer = null;
        nextRetryAt = null;
        if (state !== "waiting") return;
        transition("initializing");
        void tryStartup();
      }, delay);
    }

    function pruneReceived() {
      for (const [id, item] of received) {
        if (item.finished && (now() - item.createdAt > 120000 || received.size >= 256)) received.delete(id);
      }
    }

    function reply(owner, message) {
      if (socket === owner && owner.readyState === WebSocketImpl.OPEN) {
        try {
          let serialized = JSON.stringify(message);
          if (encoder.encode(serialized).byteLength > protocol.LIMITS.maxMessageBytes) {
            serialized = JSON.stringify({ id: message.id, ok: false, error: {
              code: "RESULT_TOO_LARGE", message: "The serialized result exceeds the reply limit; request a smaller text selection."
            } });
          }
          owner.send(serialized);
        } catch (_) { scheduleReconnect(); }
      }
    }

    async function handleMessage(owner, event) {
      if (socket !== owner || state !== "connected") return;
      if (typeof event.data !== "string" || encoder.encode(event.data).byteLength > protocol.LIMITS.maxMessageBytes) {
        scheduleReconnect();
        return;
      }
      let raw;
      try { raw = JSON.parse(event.data); }
      catch (_) { scheduleReconnect(); return; }
      let request;
      try { request = protocol.validateCommand(raw); }
      catch (error) {
        if (typeof raw?.id === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(raw.id)) {
          reply(owner, { id: raw.id, ok: false, error: safeError(error) });
        } else scheduleReconnect();
        return;
      }
      pruneReceived();
      if (received.has(request.id)) {
        reply(owner, { id: request.id, ok: false, error: { code: "DUPLICATE_COMMAND", message: "This command ID was already received; it will not be replayed." } });
        return;
      }
      if (received.size >= 256) {
        reply(owner, { id: request.id, ok: false, error: { code: "QUEUE_FULL", message: "Too many browser commands are pending." } });
        return;
      }
      const record = { createdAt: now(), finished: false };
      received.set(request.id, record);
      try {
        const result = await router.dispatch(request, { isCurrent: () => socket === owner && state === "connected" });
        reply(owner, { id: request.id, ok: true, result });
      } catch (error) {
        reply(owner, { id: request.id, ok: false, error: safeError(error) });
      } finally {
        record.finished = true;
        pruneReceived();
      }
    }

    function connect({ startup = false } = {}) {
      transition("connecting");
      const url = new URL(config.wsUrl);
      url.searchParams.set("token", config.wsToken);
      let owner;
      try { owner = new WebSocketImpl(url.href); }
      catch (error) {
        if (startup) throw error;
        scheduleReconnect();
        return;
      }
      socket = owner;
      connectTimer = timers.setTimeout(() => {
        if (socket === owner && state === "connecting") scheduleReconnect();
      }, 15000);
      owner.onopen = () => {
        if (socket !== owner || state !== "connecting") return;
        clearTimers();
        attempts = 0;
        transition("connected");
        reply(owner, {
          type: "hello", protocolVersion: protocol.PROTOCOL_VERSION,
          extensionVersion: browser.runtime.getManifest().version
        });
      };
      owner.onmessage = event => { void handleMessage(owner, event); };
      owner.onclose = () => { if (socket === owner) scheduleReconnect(); };
      owner.onerror = () => { if (socket === owner) scheduleReconnect(); };
    }

    async function tryStartup() {
      let stage = "managed-config";
      try {
        const managed = await browser.storage.managed.get(["wsUrl", "wsToken"]);
        if (state === "stopped") return snapshot();
        if (!managed || managed.wsUrl !== protocol.WS_URL || !protocol.isValidSecret(managed.wsToken)) {
          transition("blocked");
          logger({ component: "extension", error: "INVALID_MANAGED_CONFIG" });
          return snapshot();
        }
        config = { wsUrl: managed.wsUrl, wsToken: managed.wsToken };
        // A synchronous connection-initialization failure also retries the
        // managed read, rather than escaping as a mislabeled storage error.
        stage = "connection-init";
        connect({ startup: true });
      } catch (_) {
        if (!TERMINAL.has(state)) scheduleStartupRetry(stage);
      }
      return snapshot();
    }

    async function start() {
      if (started) return snapshot();
      started = true;
      return tryStartup();
    }

    function stop() {
      if (TERMINAL.has(state)) return;
      transition("stopped");
      clearTimers();
      invalidateSocket();
      config = undefined;
    }

    function snapshot() { return { state, attempts, nextRetryAt }; }
    return Object.freeze({ start, stop, snapshot });
  }

  return Object.freeze({ createConnection });
});
