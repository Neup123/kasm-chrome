'use strict';

// Real local HTTP and WebSocket sockets. These tests do not claim live Kasm,
// Firefox policy/signature acceptance, ChatGPT, Traefik or Docker coverage.
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { WebSocket } = require('ws');
const { createDriver, API_PREFIX } = require('../driver/server.js');
const { loadConfig, validateConfig, secretEquals, EXTENSION_ID, WS_URL } = require('../driver/config.js');
const { PROTOCOL_VERSION, LIMITS } = require('../extension/protocol.js');

// Prefix keeps the log-redaction test's deliberate secret-as-ID valid even when
// random base64url starts with '-' or '_'. The random portion retains 256 bits.
const API_KEY = 'A' + crypto.randomBytes(32).toString('base64url');
const WS_TOKEN = crypto.randomBytes(32).toString('base64url');
const ORIGIN = 'moz-extension://a0000000-0000-4000-8000-000000000001';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function harness(t, overrides = {}) {
  const logs = [];
  const driver = createDriver({ apiKey: API_KEY, wsToken: WS_TOKEN, log: entry => logs.push(entry),
    fixtureHosts: ['driver:8080'], ...overrides });
  const address = await driver.listen(0, '127.0.0.1');
  t.after(() => driver.close());
  return { driver, logs, base: `http://127.0.0.1:${address.port}`, ws: `ws://127.0.0.1:${address.port}/ws` };
}

async function api(h, route, { method = 'GET', body, headers = {}, key = API_KEY } = {}) {
  const r = await fetch(h.base + API_PREFIX + route, {
    method,
    headers: { ...(key === null ? {} : { 'X-API-Key': key }),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  return { status: r.status, headers: r.headers, body: await r.json() };
}

function post(h, command, extra = {}) {
  return api(h, '/commands', { method: 'POST', body: command, ...extra });
}

async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await wait(5);
  }
  assert.fail('condition did not become true');
}

async function browser(h, { hello = true } = {}) {
  const ws = new WebSocket(h.ws + '?token=' + WS_TOKEN, { origin: ORIGIN, headers: { Host: 'driver:8080' } });
  await once(ws, 'open');
  if (hello) {
    ws.send(JSON.stringify({ type: 'hello', protocolVersion: PROTOCOL_VERSION, extensionVersion: '0.1.0' }));
    await until(async () => (await api(h, '/status')).body.result.bridge.state === 'ready');
  }
  return ws;
}

async function rejectConnection(h, { token = WS_TOKEN, origin = ORIGIN, suffix = '' } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(h.ws + '?token=' + token + suffix, { origin, headers: { Host: 'driver:8080' } });
    ws.once('unexpected-response', (_, response) => { response.resume(); ws.terminate(); resolve(response.statusCode); });
    ws.once('open', () => { ws.terminate(); reject(new Error('connection unexpectedly accepted')); });
    ws.on('error', () => {});
  });
}

async function roundTrip(h, ws, command, result) {
  const received = once(ws, 'message');
  const response = post(h, command);
  const [raw] = await received;
  const dispatched = JSON.parse(raw.toString());
  ws.send(JSON.stringify({ id: dispatched.id, ok: true, result }));
  return { response: await response, dispatched };
}

test('secret loader accepts native managed-storage mounts and rejects malformed, weak or identical secrets without leaking', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasm-driver-test-'));
  try {
    const keyFile = path.join(dir, 'key');
    const managedFile = path.join(dir, 'managed.json');
    const manifest = { name: EXTENSION_ID, description: 'Driver test fixture', type: 'storage', data: { wsUrl: WS_URL, wsToken: WS_TOKEN } };
    fs.writeFileSync(keyFile, API_KEY + '\n');
    fs.writeFileSync(managedFile, JSON.stringify(manifest));
    assert.deepEqual(loadConfig({ DRIVER_API_KEY_FILE: keyFile, DRIVER_MANAGED_STORAGE_FILE: managedFile }), { apiKey: API_KEY, wsToken: WS_TOKEN });
    fs.writeFileSync(managedFile, API_KEY + 'invalid json' + WS_TOKEN);
    assert.throws(() => loadConfig({ DRIVER_API_KEY_FILE: keyFile, DRIVER_MANAGED_STORAGE_FILE: managedFile }), error => {
      assert.equal(error.message.includes(API_KEY), false);
      assert.equal(error.message.includes(WS_TOKEN), false);
      return /could not be loaded/.test(error.message);
    });
    assert.throws(() => validateConfig({ apiKey: 'weak', wsToken: WS_TOKEN }));
    assert.throws(() => validateConfig({ apiKey: API_KEY, wsToken: API_KEY }));
    assert.equal(secretEquals(API_KEY, API_KEY), true);
    assert.equal(secretEquals('bad', API_KEY), false);
    assert.equal(secretEquals(undefined, API_KEY), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('agent API requires its key, rejects browser origins, sends no CORS headers and keeps status private', async t => {
  const h = await harness(t);
  for (const key of [null, WS_TOKEN, 'incorrect']) assert.equal((await api(h, '/status', { key })).status, 401);
  const forbidden = await api(h, '/status', { headers: { Origin: 'https://chatgpt.com' } });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.has('access-control-allow-origin'), false);
  const status = await api(h, '/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.result.bridge.state, 'disconnected');
  assert.equal((await api(h, '/status?token=' + WS_TOKEN)).status, 400);
  const health = await fetch(h.base + '/healthz');
  assert.deepEqual(await health.json(), { ok: true });
});

test('WebSocket requires token and extension origin, rejects duplicate query tokens and unknown query fields', async t => {
  const h = await harness(t);
  assert.equal(await rejectConnection(h, { token: 'incorrect' }), 401);
  assert.equal(await rejectConnection(h, { origin: 'https://chatgpt.com' }), 403);
  assert.equal(await rejectConnection(h, { suffix: '&token=' + WS_TOKEN }), 401);
  assert.equal(await rejectConnection(h, { suffix: '&extra=1' }), 401);
  assert.equal((await api(h, '/status')).body.result.bridge.state, 'disconnected');
});

test('raw WebSocket traversal, encoded paths, public Host and proxy forwarding headers cannot reach the private bridge', async t => {
  const h = await harness(t);
  const authority = new URL(h.base);
  const rawUpgrade = (requestPath, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: authority.hostname, port: authority.port, method: 'GET', path: requestPath,
      headers: { Host: 'driver:8080', Connection: 'Upgrade', Upgrade: 'websocket', Origin: ORIGIN,
        'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), ...headers },
    }, response => { response.resume(); response.once('end', () => resolve(response.statusCode)); });
    req.once('upgrade', (_, socket) => { socket.destroy(); resolve(101); });
    req.once('error', reject);
    req.end();
  });
  for (const requestPath of ['/agent-driver/v1/../../ws', '/agent-driver/v1/%2e%2e/%2e%2e/ws', '/%77s', '//ws', '/ws/']) {
    assert.equal(await rawUpgrade(requestPath + '?token=' + WS_TOKEN), 404, requestPath);
  }
  assert.equal(await rawUpgrade('/ws?token=' + WS_TOKEN, { Host: 'public.invalid' }), 403);
  for (const name of ['Forwarded', 'X-Forwarded-Host', 'X-Forwarded-For', 'X-Forwarded-Proto', 'X-Forwarded-Prefix']) {
    assert.equal(await rawUpgrade('/ws?token=' + WS_TOKEN, { [name]: 'public.invalid' }), 403, name);
  }
  const ws = await browser(h);
  const { response } = await roundTrip(h, ws, { cmd: 'containers.list' }, []);
  assert.equal(response.status, 200);
});

test('commands are unavailable until compatible hello; hello timeout closes silent peer', async t => {
  const h = await harness(t, { settings: { helloTimeoutMs: 60 } });
  const ws = await browser(h, { hello: false });
  const closed = once(ws, 'close');
  assert.equal((await post(h, { cmd: 'containers.list' })).status, 503);
  await closed;
  await until(async () => (await api(h, '/status')).body.result.bridge.state === 'disconnected');
  const second = await browser(h, { hello: false });
  const secondClosed = once(second, 'close');
  second.send(JSON.stringify({ type: 'hello', protocolVersion: 999, extensionVersion: '0.1.0' }));
  await secondClosed;
  assert.equal((await api(h, '/status')).body.result.bridge.state, 'disconnected');
});

test('real HTTP→WebSocket→HTTP round trip sets authoritative deadline and unique id', async t => {
  const h = await harness(t);
  const ws = await browser(h);
  const before = Date.now();
  const { response, dispatched } = await roundTrip(h, ws, { cmd: 'containers.list', timeoutMs: 2000, deadline: 1 }, [{ name: 'ChatGPT 1' }]);
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.result, [{ name: 'ChatGPT 1' }]);
  assert.equal(typeof dispatched.id, 'string');
  assert.ok(dispatched.deadline >= before + 2000);
  assert.ok(dispatched.deadline <= Date.now() + 2000);
  assert.equal(Object.hasOwn(dispatched, 'timeoutMs'), false);
  assert.equal((await api(h, '/status')).body.result.pendingCommands, 0);
});

test('duplicate in-flight and completed request IDs are rejected without replaying browser mutations', async t => {
  const h = await harness(t);
  const ws = await browser(h);
  let dispatches = 0;
  ws.on('message', () => dispatches++);
  const received = once(ws, 'message');
  const first = post(h, { id: 'one-action', cmd: 'containers.ensure', container: 'ChatGPT 1' });
  await received;
  assert.equal((await post(h, { id: 'one-action', cmd: 'containers.ensure', container: 'ChatGPT 1' })).status, 409);
  ws.send(JSON.stringify({ id: 'one-action', ok: true, result: { cookieStoreId: 'firefox-container-1' } }));
  assert.equal((await first).status, 200);
  assert.equal((await post(h, { id: 'one-action', cmd: 'containers.ensure', container: 'ChatGPT 1' })).status, 409);
  assert.equal(dispatches, 1);
});

test('duplicate extension connection cannot replace the active ready browser', async t => {
  const h = await harness(t);
  const ws = await browser(h);
  assert.equal(await rejectConnection(h), 409);
  const { response } = await roundTrip(h, ws, { cmd: 'containers.list' }, []);
  assert.equal(response.status, 200);
});

test('timeout is explicit, late replies are ignored, and timed-out mutation is never retried', async t => {
  const h = await harness(t);
  const ws = await browser(h);
  let dispatched = 0;
  ws.on('message', () => dispatched++);
  const received = once(ws, 'message');
  const responsePromise = post(h, { id: 'slow-click', cmd: 'tabs.click', container: 'ChatGPT 1', tabId: 1, selector: '#send', timeoutMs: 100 });
  await received;
  const response = await responsePromise;
  assert.equal(response.status, 504);
  assert.equal(response.body.error.code, 'COMMAND_TIMEOUT');
  assert.match(response.body.error.message, /may already have run/);
  ws.send(JSON.stringify({ id: 'slow-click', ok: true, result: { clicked: true } }));
  assert.equal((await post(h, { id: 'slow-click', cmd: 'containers.list' })).status, 409);
  const next = await roundTrip(h, ws, { cmd: 'containers.list' }, []);
  assert.equal(next.response.status, 200);
  assert.equal(dispatched, 2);
});

test('disconnect fails pending work and a replacement browser works without replay', async t => {
  const h = await harness(t);
  const first = await browser(h);
  const received = once(first, 'message');
  const pending = post(h, { id: 'before-restart', cmd: 'tabs.type', container: 'ChatGPT 1', tabId: 1, selector: '#composer', text: 'placeholder' });
  await received;
  first.close();
  const failed = await pending;
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error.code, 'BRIDGE_DISCONNECTED');
  await until(async () => (await api(h, '/status')).body.result.bridge.state === 'disconnected');
  const second = await browser(h);
  const receivedIds = [];
  second.on('message', bytes => receivedIds.push(JSON.parse(bytes).id));
  const { response } = await roundTrip(h, second, { id: 'after-restart', cmd: 'containers.list' }, []);
  assert.equal(response.status, 200);
  assert.deepEqual(receivedIds, ['after-restart']);
});

test('malformed browser replies are not successful and malformed JSON disconnects cleanly', async t => {
  const h = await harness(t);
  let ws = await browser(h);
  let received = once(ws, 'message');
  const pending = post(h, { id: 'bad-reply', cmd: 'containers.list' });
  await received;
  ws.send(JSON.stringify({ id: 'bad-reply', ok: true, error: { code: 'FAKE', message: 'not a result' } }));
  const failed = await pending;
  assert.equal(failed.status, 502);
  assert.equal(failed.body.error.code, 'INVALID_BROWSER_REPLY');
  await until(async () => (await api(h, '/status')).body.result.bridge.state === 'disconnected');
  ws = await browser(h);
  received = once(ws, 'message');
  const second = post(h, { id: 'bad-json', cmd: 'containers.list' });
  await received;
  ws.send('{not-json:' + WS_TOKEN + '}');
  assert.equal((await second).body.error.code, 'BRIDGE_DISCONNECTED');
  assert.equal(JSON.stringify(h.logs).includes(WS_TOKEN), false);
});

test('unknown reply id cannot resolve a different command and structured errors retain their reason', async t => {
  const h = await harness(t);
  const ws = await browser(h);
  const received = once(ws, 'message');
  const pending = post(h, { id: 'correct-id', cmd: 'tabs.click', container: 'ChatGPT 1', tabId: 1, selector: '#send' });
  await received;
  ws.send(JSON.stringify({ id: 'wrong-id', ok: true, result: true }));
  ws.send(JSON.stringify({ id: 'correct-id', ok: false, error: { code: 'AMBIGUOUS_SELECTOR', message: 'Selector matched multiple elements.' } }));
  const failed = await pending;
  assert.equal(failed.status, 422);
  assert.equal(failed.body.error.code, 'AMBIGUOUS_SELECTOR');
});

test('shared command validation rejects arbitrary JS, unscoped tabs, prohibited URLs and wrong content types', async t => {
  const h = await harness(t);
  assert.equal((await post(h, { cmd: 'tabs.eval', container: 'ChatGPT 1', tabId: 1, code: 'alert(1)' })).body.error.code, 'REMOTE_CODE_FORBIDDEN');
  assert.equal((await post(h, { cmd: 'tabs.close', tabId: 1 })).status, 400);
  assert.equal((await post(h, { cmd: 'tabs.create', container: 'ChatGPT 1', url: 'https://example.com/' })).body.error.code, 'URL_NOT_ALLOWED');
  assert.equal((await post(h, { cmd: 'containers.list', unexpected: WS_TOKEN })).status, 400);
  assert.equal((await post(h, '{invalid')).body.error.code, 'INVALID_JSON');
  assert.equal((await post(h, { cmd: 'containers.list' }, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await post(h, { cmd: 'containers.list', timeoutMs: 0 })).body.error.code, 'INVALID_TIMEOUT');
  assert.equal((await post(h, { cmd: 'containers.list', timeoutMs: LIMITS.maxTimeoutMs + 1 })).status, 400);
});

test('HTTP body and concurrent work limits reject without dispatching excess work', async t => {
  const h = await harness(t, { settings: { maxHttpBodyBytes: 1024, maxReplayEntries: 1 } });
  assert.equal((await post(h, { cmd: 'containers.list', padding: 'x'.repeat(2048) })).status, 413);
  const ws = await browser(h);
  const received = once(ws, 'message');
  const first = post(h, { id: 'capacity-one', cmd: 'containers.list' });
  await received;
  const second = await post(h, { id: 'capacity-two', cmd: 'containers.list' });
  assert.equal(second.status, 429);
  assert.equal(second.body.error.code, 'BUSY');
  ws.send(JSON.stringify({ id: 'capacity-one', ok: true, result: [] }));
  assert.equal((await first).status, 200);
  const chunked = await new Promise((resolve, reject) => {
    const req = http.request(h.base + API_PREFIX + '/commands', { method: 'POST', headers: {
      'X-API-Key': API_KEY, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked',
    } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    req.on('error', reject);
    req.write('{"padding":"');
    req.write('x'.repeat(2048));
    req.end('"}');
  });
  assert.equal(chunked, 413);
});

test('audit logs exclude keys, tokens, command text, selectors, container names and results', async t => {
  const h = await harness(t);
  const ws = await browser(h);
  const secretText = 'private composer text that must never enter logs';
  const selector = '#private-selector';
  const { response } = await roundTrip(h, ws, {
    id: API_KEY, cmd: 'tabs.type', container: 'Private Container', tabId: 1, selector, text: secretText,
  }, { text: secretText, token: WS_TOKEN });
  assert.equal(response.status, 200);
  const logged = JSON.stringify(h.logs);
  for (const secret of [API_KEY, WS_TOKEN, secretText, selector, 'Private Container']) assert.equal(logged.includes(secret), false);
  assert.match(logged, /tabs.type/);
  assert.match(logged, /succeeded/);
});

test('private placeholder fixture uses HttpOnly cookie and same-origin storage script, and rejects public host', async t => {
  const h = await harness(t);
  const privateFetch = (suffix, headers = {}) => new Promise((resolve, reject) => {
    const request = http.get(h.base + '/fixtures/' + suffix, { headers: { Host: 'driver:8080', ...headers } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode,
        headers: { get: name => response.headers[name.toLowerCase()]?.toString() || null },
        text: async () => Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
  });
  assert.equal((await fetch(h.base + '/fixtures/session?slot=A')).status, 404);
  const first = await privateFetch('session?slot=A');
  assert.equal(first.status, 200);
  assert.match(first.headers.get('set-cookie'), /kasm_probe=A;.*Max-Age=3600; HttpOnly; SameSite=Strict/);
  assert.match(await first.text(), /Cookie session: A/);
  const persisted = await privateFetch('session', { Cookie: 'kasm_probe=B' });
  assert.match(await persisted.text(), /Cookie session: B/);
  const script = await privateFetch('session.js');
  assert.match(await script.text(), /localStorage\.setItem\('kasm_probe'/);
  assert.match(first.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal((await privateFetch('session?slot=%3Cscript%3E')).status, 400);
  assert.equal((await api(h, '/fixtures/session?slot=A')).status, 400);
});
