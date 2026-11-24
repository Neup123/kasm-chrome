'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const protocol = require('../extension/protocol');
const { safeError } = require('../extension/core');
const { createConnection } = require('../extension/transport');

function harness({ managed = { wsUrl: 'ws://driver:8080/ws', wsToken: 'x'.repeat(64) }, dispatch, managedGet, socketInit } = {}) {
  let clock = 1000;
  let sequence = 0;
  const pending = new Map();
  const sockets = [];
  const logs = [];
  const commands = [];
  const timers = {
    setTimeout(fn, delay) { const id = ++sequence; pending.set(id, { fn, at: clock + delay }); return id; },
    clearTimeout(id) { pending.delete(id); }
  };
  class Socket {
    static OPEN = 1;
    static CLOSED = 3;
    constructor(url) { socketInit?.(url); this.url = url; this.readyState = 0; this.messages = []; sockets.push(this); }
    open() { this.readyState = 1; this.onopen?.(); }
    send(value) { this.messages.push(JSON.parse(value)); }
    close() { this.readyState = 3; this.onclose?.(); }
    receive(value) { this.onmessage?.({ data: typeof value === 'string' ? value : JSON.stringify(value) }); }
  }
  const connection = createConnection({
    browser: { storage: { managed: { get: managedGet || (async () => managed) } }, runtime: { getManifest: () => ({ version: '0.1.0' }) } },
    protocol, safeError, WebSocketImpl: Socket, now: () => clock, random: () => 0.5, timers,
    logger: entry => logs.push(entry),
    router: { dispatch: async (request, options) => { commands.push(request); return dispatch ? dispatch(request, options) : { done: true }; } }
  });
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };
  async function advance(ms) {
    clock += ms;
    for (const [id, timer] of [...pending]) {
      if (timer.at <= clock) { pending.delete(id); timer.fn(); }
    }
    await settle();
  }
  return { connection, sockets, logs, pending, commands, advance, settle };
}

const command = (id = 'req-1') => ({ id, cmd: 'containers.list', deadline: 60000 });

test('managed configuration opens one token-authenticated socket with compatible hello', async () => {
  const h = harness();
  await h.connection.start();
  await h.connection.start();
  assert.equal(h.sockets.length, 1);
  const socket = h.sockets[0];
  assert.equal(new URL(socket.url).searchParams.get('token'), 'x'.repeat(64));
  socket.open();
  assert.deepEqual(socket.messages[0], { type: 'hello', protocolVersion: 1, extensionVersion: '0.1.0' });
  assert.equal(h.connection.snapshot().state, 'connected');
  assert.equal(JSON.stringify(h.logs).includes('x'.repeat(64)), false);
  assert.equal(JSON.stringify(h.logs).includes('ws://'), false);
  h.connection.stop();
});

test('missing or out-of-scope managed settings block rather than defaulting or exposing another origin', async () => {
  for (const managed of [{}, { wsUrl: 'wss://outside.example/ws', wsToken: 'x'.repeat(64) }, { wsUrl: 'ws://driver:8080/ws', wsToken: 'short' }]) {
    const h = harness({ managed });
    await h.connection.start();
    assert.equal(h.connection.snapshot().state, 'blocked');
    assert.equal(h.sockets.length, 0);
    assert.equal(h.pending.size, 0);
  }
});

test('requests receive structured replies and duplicate IDs do not execute twice', async () => {
  const h = harness();
  await h.connection.start();
  const socket = h.sockets[0]; socket.open();
  socket.receive(command());
  await h.settle();
  socket.receive(command());
  await h.settle();
  assert.equal(h.commands.length, 1);
  assert.deepEqual(socket.messages[1], { id: 'req-1', ok: true, result: { done: true } });
  assert.equal(socket.messages[2].error.code, 'DUPLICATE_COMMAND');
  socket.receive({ ...command('bad-script'), cmd: 'tabs.eval', container: 'ChatGPT 1', tabId: 1, script: 'document.cookie' });
  await h.settle();
  assert.equal(socket.messages[3].error.code, 'REMOTE_CODE_FORBIDDEN');
  assert.equal(h.commands.length, 1);
  h.connection.stop();
});

test('reconnect has bounded backoff and stale socket callbacks cannot close its replacement', async () => {
  const h = harness();
  await h.connection.start();
  const first = h.sockets[0]; first.open(); first.close();
  assert.equal(h.connection.snapshot().state, 'waiting');
  await h.advance(1000);
  const second = h.sockets[1]; second.open();
  first.onclose(); first.onerror();
  assert.equal(h.connection.snapshot().state, 'connected');
  assert.equal(h.sockets.length, 2);
  second.receive(command());
  await h.settle();
  assert.equal(second.messages[1].ok, true);
  h.connection.stop();
});

test('an old request reply is not sent over the replacement connection and its guard invalidates', async () => {
  let resolveRequest;
  let ownership;
  const h = harness({ dispatch: (_, options) => { ownership = options; return new Promise(resolve => { resolveRequest = resolve; }); } });
  await h.connection.start();
  const first = h.sockets[0]; first.open(); first.receive(command());
  await h.settle();
  assert.equal(ownership.isCurrent(), true);
  first.close();
  assert.equal(ownership.isCurrent(), false);
  await h.advance(1000);
  const second = h.sockets[1]; second.open();
  resolveRequest({ done: true });
  await h.settle();
  assert.equal(first.messages.length, 1);
  assert.equal(second.messages.length, 1);
  second.receive(command());
  await h.settle();
  assert.equal(second.messages[1].error.code, 'DUPLICATE_COMMAND');
  assert.equal(h.commands.length, 1);
  h.connection.stop();
});

test('stalled handshakes time out and repeated connection failures cap at thirty seconds', async () => {
  const h = harness();
  await h.connection.start();
  await h.advance(15000);
  assert.equal(h.connection.snapshot().state, 'waiting');
  for (let attempt = 0; attempt < 10; attempt++) {
    const snapshot = h.connection.snapshot();
    const next = Math.min(...[...h.pending.values()].map(timer => timer.at));
    assert.ok(next <= snapshot.nextRetryAt);
    await h.advance(30000);
    const socket = h.sockets.at(-1);
    socket.onerror();
    assert.equal(h.connection.snapshot().state, 'waiting');
    const delay = [...h.pending.values()][0].at - (16000 + (attempt + 1) * 30000);
    assert.ok(delay >= 1000 && delay <= 30000);
  }
  h.connection.stop();
  assert.equal(h.pending.size, 0);
});

test('oversized Unicode replies return a clear bounded error and incoming bytes are enforced', async () => {
  const h = harness({ dispatch: async () => ({ text: '😀'.repeat(150000) }) });
  await h.connection.start();
  const socket = h.sockets[0]; socket.open(); socket.receive(command());
  await h.settle();
  assert.equal(socket.messages[1].error.code, 'RESULT_TOO_LARGE');
  assert.ok(Buffer.byteLength(JSON.stringify(socket.messages[1])) < protocol.LIMITS.maxMessageBytes);
  // Fewer JavaScript characters than the byte limit, but more UTF-8 bytes.
  socket.receive(JSON.stringify({ text: '😀'.repeat(150000) }));
  assert.equal(h.connection.snapshot().state, 'waiting');
  assert.equal(h.commands.length, 1);
  h.connection.stop();
});

test('duplicate bookkeeping stays bounded even when all outstanding commands are unfinished', async () => {
  const resolvers = [];
  const h = harness({ dispatch: () => new Promise(resolve => { resolvers.push(resolve); }) });
  await h.connection.start();
  const socket = h.sockets[0]; socket.open();
  for (let i = 0; i < 260; i++) socket.receive(command(`pending-${i}`));
  await h.settle();
  assert.equal(h.commands.length, 256);
  assert.equal(socket.messages.filter(reply => reply.error?.code === 'QUEUE_FULL').length, 4);
  h.connection.stop();
  for (const resolve of resolvers) resolve({ done: true });
  await h.settle();
});

test('startup retries transient managed reads and synchronous socket initialization failures', async () => {
  let reads = 0;
  let opens = 0;
  const h = harness({
    managedGet: async () => {
      if (++reads === 1) throw new TypeError('Storage temporarily unavailable');
      return { wsUrl: protocol.WS_URL, wsToken: 'x'.repeat(64) };
    },
    socketInit: () => {
      if (++opens === 1) throw new Error('Socket initialization failed');
    }
  });
  await h.connection.start();
  assert.equal(h.connection.snapshot().state, 'waiting');
  await h.advance(1000);
  assert.equal(h.connection.snapshot().state, 'waiting');
  await h.advance(2000);
  assert.equal(reads, 3);
  assert.equal(h.sockets.length, 1);
  h.sockets[0].open();
  assert.equal(h.connection.snapshot().state, 'connected');
  assert.deepEqual(h.logs.filter(x => x.error === 'STARTUP_ATTEMPT_FAILED').map(x => [x.exceptionName, x.exceptionMessage]),
    [['TypeError', 'Storage temporarily unavailable'], ['Error', 'Socket initialization failed']]);
  h.connection.stop();
});

test('persistent startup exceptions block only after six attempts over thirty seconds', async () => {
  for (const failConnect of [false, true]) {
    let reads = 0;
    const h = harness({
      managedGet: async () => {
        reads++;
        if (!failConnect) throw new Error('Storage unavailable');
        return { wsUrl: protocol.WS_URL, wsToken: 'x'.repeat(64) };
      },
      socketInit: url => { throw new Error('Cannot open ' + url); }
    });
    await h.connection.start();
    for (const delay of [1000, 2000, 4000, 8000, 15000]) {
      assert.equal(h.connection.snapshot().state, 'waiting');
      await h.advance(delay);
    }
    assert.equal(reads, 6);
    assert.equal(h.connection.snapshot().state, 'blocked');
    assert.equal(h.pending.size, 0);
    assert.equal(h.logs.filter(x => x.error === 'STARTUP_ATTEMPT_FAILED').length, 6);
    assert.equal(h.logs.at(-1).error, 'STARTUP_RETRIES_EXHAUSTED');
    assert.equal(JSON.stringify(h.logs).includes('x'.repeat(64)), false);
    assert.equal(JSON.stringify(h.logs).includes('ws://'), false);
  }
});

test('stopping during startup backoff cancels subsequent managed reads', async () => {
  let reads = 0;
  const h = harness({ managedGet: async () => { reads++; throw new Error('Unavailable'); } });
  await h.connection.start();
  h.connection.stop();
  await h.advance(30000);
  assert.equal(reads, 1);
  assert.equal(h.connection.snapshot().state, 'stopped');
  assert.equal(h.pending.size, 0);
});
