'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');
const { validateCommand, LIMITS, PROTOCOL_VERSION } = require('../extension/protocol.js');
const { validateConfig, secretEquals, loadConfig } = require('./config.js');

const API_PREFIX = '/agent-driver/v1';
const BRIDGE = Object.freeze({ DISCONNECTED: 'disconnected', HANDSHAKING: 'handshaking', READY: 'ready' });
const COMMAND = Object.freeze({ PENDING: 'pending', SUCCEEDED: 'succeeded', FAILED: 'failed', TIMED_OUT: 'timed_out' });
const TERMINAL_COMMANDS = new Set([COMMAND.SUCCEEDED, COMMAND.FAILED, COMMAND.TIMED_OUT]);
const TRANSITIONS = Object.freeze({
  [BRIDGE.DISCONNECTED]: new Set([BRIDGE.HANDSHAKING]),
  [BRIDGE.HANDSHAKING]: new Set([BRIDGE.READY, BRIDGE.DISCONNECTED]),
  [BRIDGE.READY]: new Set([BRIDGE.DISCONNECTED]),
});
const ERROR_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const DEFAULTS = Object.freeze({
  requestTimeoutMs: 15_000,
  helloTimeoutMs: 5_000,
  heartbeatMs: 15_000,
  replayTtlMs: 15 * 60_000,
  maxReplayEntries: 10_000,
  maxHttpBodyBytes: LIMITS.maxMessageBytes,
});

function errorReply(id, code, message) {
  return { id: id ?? null, ok: false, error: { code, message } };
}

function json(res, status, data) {
  if (res.destroyed || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function rejectUpgrade(socket, status) {
  const labels = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict' };
  socket.end(`HTTP/1.1 ${status} ${labels[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

function hasForwardingHeaders(req) {
  return Object.keys(req.headers).some(name => name === 'forwarded' || name.startsWith('x-forwarded-'));
}

function requestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    let settled = false;
    const fail = (code, status) => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      reject(Object.assign(new Error(code), { code, status }));
    };
    req.on('data', chunk => {
      if (settled) return;
      length += chunk.length;
      if (length > maxBytes) return fail('BODY_TOO_LARGE', 413);
      chunks.push(chunk);
    });
    req.on('aborted', () => fail('REQUEST_ABORTED', 400));
    req.on('error', () => fail('REQUEST_ABORTED', 400));
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('INVALID_JSON'), { code: 'INVALID_JSON', status: 400 })); }
    });
  });
}

function createDriver(input) {
  const { apiKey, wsToken } = validateConfig(input);
  const settings = { ...DEFAULTS, ...input.settings };
  const logSink = input.log || (entry => process.stdout.write(JSON.stringify(entry) + '\n'));
  const fixtureHosts = new Set(input.fixtureHosts || ['driver:8080']);
  const pending = new Map();
  const seenIds = new Map();
  let bridgeState = BRIDGE.DISCONNECTED;
  let peer = null;
  let peerVersion = null;
  let helloTimer = null;
  let heartbeatTimer = null;
  let stopped = false;

  function safeLog(entry) {
    // Only allow metadata created here. Even an identifier equal to a secret is redacted.
    const text = JSON.stringify(entry).replaceAll(apiKey, '[redacted]').replaceAll(wsToken, '[redacted]');
    try { logSink(JSON.parse(text)); } catch { /* logging cannot break command dispatch */ }
  }

  function transitionBridge(next, socket = peer) {
    if (!TRANSITIONS[bridgeState].has(next)) throw new Error('Invalid bridge transition');
    bridgeState = next;
    if (next === BRIDGE.HANDSHAKING) peer = socket;
    if (next === BRIDGE.DISCONNECTED) {
      clearTimeout(helloTimer);
      clearInterval(heartbeatTimer);
      helloTimer = heartbeatTimer = null;
      peer = null;
      peerVersion = null;
      for (const id of [...pending.keys()]) {
        finishCommand(id, COMMAND.FAILED, 503, errorReply(id, 'BRIDGE_DISCONNECTED',
          'Browser connection ended after dispatch. The command may have run; inspect before retrying.'));
      }
    }
    safeLog({ event: 'bridge', state: next });
  }

  function finishCommand(id, state, status, reply) {
    const entry = pending.get(id);
    if (!entry || entry.state !== COMMAND.PENDING || !TERMINAL_COMMANDS.has(state)) return false;
    entry.state = state;
    clearTimeout(entry.timer);
    pending.delete(id);
    safeLog({ event: 'command', id, cmd: entry.cmd, state, durationMs: Date.now() - entry.startedAt,
      code: reply.ok ? 'OK' : reply.error.code });
    json(entry.res, status, reply);
    return true;
  }

  function pruneSeenIds() {
    const now = Date.now();
    for (const [id, expires] of seenIds) if (expires <= now && !pending.has(id)) seenIds.delete(id);
  }

  function disconnect(socket) {
    if (socket !== peer) return;
    transitionBridge(BRIDGE.DISCONNECTED);
    socket.terminate();
  }

  function handleMessage(socket, bytes, isBinary) {
    if (socket !== peer) return;
    if (isBinary) return disconnect(socket);
    let message;
    try { message = JSON.parse(bytes.toString('utf8')); }
    catch { return disconnect(socket); }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return disconnect(socket);
    if (bridgeState === BRIDGE.HANDSHAKING) {
      if (message.type !== 'hello' || message.protocolVersion !== PROTOCOL_VERSION ||
          typeof message.extensionVersion !== 'string' || !/^\d+(\.\d+){0,3}$/.test(message.extensionVersion)) {
        return disconnect(socket);
      }
      clearTimeout(helloTimer);
      helloTimer = null;
      peerVersion = message.extensionVersion;
      transitionBridge(BRIDGE.READY);
      return;
    }
    if (bridgeState !== BRIDGE.READY || typeof message.id !== 'string' ||
        !message.id.length || message.id.length > LIMITS.maxIdLength) return disconnect(socket);
    // A timed-out/abandoned reply can legitimately arrive late. Never dispatch it again.
    if (!pending.has(message.id)) return;
    if (message.ok === true && Object.hasOwn(message, 'result') && !Object.hasOwn(message, 'error')) {
      finishCommand(message.id, COMMAND.SUCCEEDED, 200, { id: message.id, ok: true, result: message.result });
    } else if (message.ok === false && message.error && ERROR_PATTERN.test(message.error.code) &&
               typeof message.error.message === 'string' && message.error.message.length <= 500 &&
               !Object.hasOwn(message, 'result')) {
      finishCommand(message.id, COMMAND.FAILED, 422, {
        id: message.id, ok: false,
        error: { code: message.error.code, message: message.error.message.replace(/[\x00-\x1f]/g, ' ') },
      });
    } else {
      finishCommand(message.id, COMMAND.FAILED, 502, errorReply(message.id, 'INVALID_BROWSER_REPLY',
        'Browser reply did not match the command protocol.'));
      disconnect(socket);
    }
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxMessageBytes, perMessageDeflate: false });
  wss.on('connection', socket => {
    if (stopped || bridgeState !== BRIDGE.DISCONNECTED) return socket.close(1008, 'Already connected');
    transitionBridge(BRIDGE.HANDSHAKING, socket);
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', (bytes, isBinary) => handleMessage(socket, bytes, isBinary));
    socket.on('close', () => { if (peer === socket) transitionBridge(BRIDGE.DISCONNECTED); });
    socket.on('error', () => disconnect(socket));
    helloTimer = setTimeout(() => disconnect(socket), settings.helloTimeoutMs);
    heartbeatTimer = setInterval(() => {
      if (peer !== socket) return;
      if (!socket.isAlive) return disconnect(socket);
      socket.isAlive = false;
      socket.ping();
    }, settings.heartbeatMs);
    helloTimer.unref();
    heartbeatTimer.unref();
  });

  async function dispatch(req, res) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      return json(res, 415, errorReply(null, 'CONTENT_TYPE', 'Use application/json.'));
    }
    if (Number(req.headers['content-length'] || 0) > settings.maxHttpBodyBytes) {
      req.resume();
      return json(res, 413, errorReply(null, 'BODY_TOO_LARGE', 'Request body exceeds the limit.'));
    }
    let supplied;
    try { supplied = await requestBody(req, settings.maxHttpBodyBytes); }
    catch (e) { return json(res, e.status || 400, errorReply(null, e.code || 'INVALID_JSON', 'Invalid request body.')); }
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) {
      return json(res, 400, errorReply(null, 'INVALID_COMMAND', 'Command must be an object.'));
    }
    const id = supplied.id ?? crypto.randomUUID();
    if (typeof id !== 'string' || !id.length || id.length > LIMITS.maxIdLength) {
      return json(res, 400, errorReply(null, 'INVALID_ID', 'Use a unique bounded identifier.'));
    }
    const timeoutMs = supplied.timeoutMs ?? settings.requestTimeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > LIMITS.maxTimeoutMs) {
      return json(res, 400, errorReply(id, 'INVALID_TIMEOUT', 'timeoutMs must be an integer from 100 to 60000.'));
    }
    const rawCommand = { ...supplied, id, deadline: Date.now() + timeoutMs };
    delete rawCommand.timeoutMs;
    let command;
    try { command = validateCommand(rawCommand); }
    catch (e) {
      const code = ERROR_PATTERN.test(e.code || '') ? e.code : 'INVALID_COMMAND';
      return json(res, 400, errorReply(id, code, 'Command rejected by the shared protocol validator.'));
    }
    pruneSeenIds();
    if (seenIds.has(id)) return json(res, 409, errorReply(id, 'DUPLICATE_ID', 'This request ID was already accepted. Inspect the result; use unique IDs for new actions.'));
    if (bridgeState !== BRIDGE.READY || peer?.readyState !== WebSocket.OPEN) {
      return json(res, 503, errorReply(id, 'BROWSER_UNAVAILABLE', 'The signed browser extension is not connected and ready.'));
    }
    if (pending.size >= LIMITS.maxQueue || seenIds.size >= settings.maxReplayEntries) {
      return json(res, 429, errorReply(id, 'BUSY', 'Driver command capacity reached. The command was not dispatched.'));
    }
    const serialized = JSON.stringify(command);
    if (Buffer.byteLength(serialized) > LIMITS.maxMessageBytes || peer.bufferedAmount > LIMITS.maxMessageBytes) {
      return json(res, 429, errorReply(id, 'BUSY', 'Browser transport capacity reached. The command was not dispatched.'));
    }
    const startedAt = Date.now();
    const entry = { res, cmd: command.cmd, startedAt, state: COMMAND.PENDING, timer: null };
    seenIds.set(id, startedAt + settings.replayTtlMs);
    pending.set(id, entry);
    entry.timer = setTimeout(() => finishCommand(id, COMMAND.TIMED_OUT, 504,
      errorReply(id, 'COMMAND_TIMEOUT', 'Browser command timed out. It may already have run; inspect before retrying.')), timeoutMs);
    entry.timer.unref();
    res.on('close', () => {
      if (!res.writableEnded) finishCommand(id, COMMAND.FAILED, 499,
        errorReply(id, 'CLIENT_DISCONNECTED', 'Client disconnected after dispatch. The command may have run.'));
    });
    peer.send(serialized, error => {
      if (error) finishCommand(id, COMMAND.FAILED, 503,
        errorReply(id, 'BRIDGE_SEND_FAILED', 'Browser transport failed. Inspect before retrying the command.'));
    });
  }

  async function handler(req, res) {
    let url;
    try { url = new URL(req.url, 'http://driver:8080'); }
    catch { return json(res, 400, errorReply(null, 'BAD_REQUEST', 'Invalid request.')); }
    // Route on the original path, never a normalized traversal from a public
    // API prefix into an internal endpoint. All supported paths are literal.
    if (req.url.split('?')[0] !== url.pathname) {
      return json(res, 400, errorReply(null, 'BAD_REQUEST', 'Invalid request path.'));
    }
    if (url.pathname === '/healthz' && req.method === 'GET') return json(res, 200, { ok: true });
    if (url.pathname.startsWith('/fixtures/')) return serveFixture(req, res, url, fixtureHosts);
    if (url.pathname !== API_PREFIX && !url.pathname.startsWith(API_PREFIX + '/')) {
      return json(res, 404, errorReply(null, 'NOT_FOUND', 'Unknown endpoint.'));
    }
    if (!secretEquals(req.headers['x-api-key'], apiKey)) return json(res, 401, errorReply(null, 'UNAUTHORIZED', 'Valid X-API-Key required.'));
    if (req.headers.origin !== undefined) return json(res, 403, errorReply(null, 'BROWSER_ORIGIN_FORBIDDEN', 'Use a server-side API client.'));
    if (url.search) return json(res, 400, errorReply(null, 'QUERY_FORBIDDEN', 'API endpoints do not accept query strings.'));
    if (url.pathname === API_PREFIX + '/status' && req.method === 'GET') {
      return json(res, 200, { ok: true, result: { protocolVersion: PROTOCOL_VERSION,
        bridge: { state: bridgeState, extensionVersion: peerVersion }, pendingCommands: pending.size } });
    }
    if (url.pathname === API_PREFIX + '/commands' && req.method === 'POST') return dispatch(req, res);
    if (url.pathname === API_PREFIX + '/openapi.json' && req.method === 'GET') return json(res, 200, require('../docs/openapi.json'));
    return json(res, 404, errorReply(null, 'NOT_FOUND', 'Unknown endpoint.'));
  }

  const server = http.createServer({ maxHeaderSize: 16 * 1024, requestTimeout: 20_000, headersTimeout: 10_000 }, (req, res) => {
    handler(req, res).catch(() => json(res, 500, errorReply(null, 'INTERNAL_ERROR', 'Driver request failed.')));
  });
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  server.on('clientError', (_, socket) => { if (socket.writable) rejectUpgrade(socket, 400); });
  server.on('upgrade', (req, socket, head) => {
    // The proxy routes only the API prefix. Enforce that boundary independently
    // of any proxy path normalization or Host rewriting.
    if (req.url.split('?')[0] !== '/ws') return rejectUpgrade(socket, 404);
    if (req.headers.host !== 'driver:8080' || hasForwardingHeaders(req)) return rejectUpgrade(socket, 403);
    let url;
    try { url = new URL(req.url, 'http://driver:8080'); }
    catch { return rejectUpgrade(socket, 400); }
    if (url.pathname !== '/ws') return rejectUpgrade(socket, 404);
    if (url.searchParams.getAll('token').length !== 1 ||
        [...url.searchParams.keys()].some(key => key !== 'token') ||
        !secretEquals(url.searchParams.get('token'), wsToken)) return rejectUpgrade(socket, 401);
    if (typeof req.headers.origin !== 'string' || !/^moz-extension:\/\/[a-z0-9-]+\/?$/i.test(req.headers.origin)) {
      return rejectUpgrade(socket, 403);
    }
    if (stopped || bridgeState !== BRIDGE.DISCONNECTED) return rejectUpgrade(socket, 409);
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  return {
    server,
    async listen(port = 8080, host = '0.0.0.0') {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
      return server.address();
    },
    async close() {
      stopped = true;
      if (peer) disconnect(peer);
      clearTimeout(helloTimer);
      clearInterval(heartbeatTimer);
      await new Promise(resolve => wss.close(resolve));
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    },
  };
}

function serveFixture(req, res, url, hosts) {
  if (req.method !== 'GET' || !hosts.has(req.headers.host) || hasForwardingHeaders(req)) return json(res, 404, errorReply(null, 'NOT_FOUND', 'Unknown endpoint.'));
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'" };
  if (url.pathname === '/fixtures/session.js') {
    const body = fs.readFileSync(path.join(__dirname, 'fixture.js'));
    res.writeHead(200, { ...headers, 'Content-Type': 'application/javascript; charset=utf-8' });
    return res.end(body);
  }
  if (url.pathname !== '/fixtures/session') return json(res, 404, errorReply(null, 'NOT_FOUND', 'Unknown endpoint.'));
  const slot = url.searchParams.get('slot');
  if (slot !== null && slot !== 'A' && slot !== 'B') return json(res, 400, errorReply(null, 'INVALID_SLOT', 'Use fixture slot A or B.'));
  const cookie = /(?:^|;\s*)kasm_probe=([AB])(?:;|$)/.exec(req.headers.cookie || '')?.[1] || 'unset';
  if (slot) headers['Set-Cookie'] = `kasm_probe=${slot}; Path=/fixtures; HttpOnly; SameSite=Strict`;
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Container isolation fixture</title>
<main><h1>Container isolation fixture</h1><p>This page uses placeholder data only.</p>
<p id="cookie">Cookie session: ${slot || cookie}</p><p id="storage">Local storage: pending</p>
<label for="composer">Textarea composer</label><textarea id="composer"></textarea>
<label for="rich-composer">Editable composer</label><div id="rich-composer" role="textbox" contenteditable="true" aria-label="Editable composer"></div>
<button id="send" type="button">Send placeholder</button><output id="sent" aria-live="polite"></output>
<p id="events">Input events: 0</p></main><script src="/fixtures/session.js"></script></html>`;
  res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

if (require.main === module) {
  let driver;
  try { driver = createDriver(loadConfig()); }
  catch { process.stderr.write('Driver configuration is invalid; check secret mounts.\n'); process.exit(1); }
  driver.listen().then(() => process.stdout.write('{"event":"listening","port":8080}\n')).catch(() => {
    process.stderr.write('Driver could not start.\n'); process.exit(1);
  });
  const shutdown = () => driver.close().finally(() => process.exit(0));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

module.exports = { createDriver, API_PREFIX, BRIDGE, COMMAND, TERMINAL_COMMANDS, DEFAULTS };
