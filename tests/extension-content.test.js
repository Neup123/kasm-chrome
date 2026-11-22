'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const protocol = require('../extension/protocol');
const { createContentExecutor } = require('../extension/content');

function harness(html, url = 'https://chatgpt.com/') {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  const { window } = dom;
  window.HTMLElement.prototype.getClientRects = function () { return [{ x: 0, y: 0, width: 100, height: 20 }]; };
  const executor = createContentExecutor({ window, document: window.document, protocol,
    extensionId: 'kasm-agent@chabad.gr', documentToken: 'test-document-token', now: () => 1000 });
  async function command(cmd, fields = {}, messageFields = {}, sender = { id: 'kasm-agent@chabad.gr' }) {
    return executor.handle({ kind: 'kasm-agent-dom-v1', documentToken: 'test-document-token', expectedUrl: url,
      command: { id: 'dom-test', cmd, container: 'ChatGPT 1', tabId: 1, deadline: 10000, ...fields }, ...messageFields }, sender);
  }
  return { window, document: window.document, command, close: () => window.close() };
}

test('read text returns bounded inner text and a truncation indication', async () => {
  const h = harness('<main>Visible fixture text</main>');
  const reply = await h.command('tabs.readText', { selector: 'main', maxLength: 7 });
  assert.equal(reply.ok, true);
  assert.equal(reply.result.text, 'Visible');
  assert.equal(reply.result.truncated, true);
  h.close();
});

test('click calls exactly one verified DOM element click without mouse or keyboard events', async () => {
  const h = harness('<button id="send">Send</button><button>Other</button>');
  let clicks = 0;
  h.document.querySelector('#send').addEventListener('click', () => { clicks++; });
  assert.equal((await h.command('tabs.click', { selector: '#send' })).ok, true);
  assert.equal(clicks, 1);
  assert.equal((await h.command('tabs.click', { selector: 'button' })).error.code, 'ELEMENT_AMBIGUOUS');
  assert.equal((await h.command('tabs.click', { selector: '#missing' })).error.code, 'ELEMENT_NOT_FOUND');
  assert.equal((await h.command('tabs.click', { selector: '[' })).error.code, 'INVALID_SELECTOR');
  assert.equal(clicks, 1);
  h.close();
});

test('native setter bypasses an instance setter and emits input/change with retained value', async () => {
  const h = harness('<input id="composer" type="text">');
  const input = h.document.querySelector('#composer');
  const native = Object.getOwnPropertyDescriptor(h.window.HTMLInputElement.prototype, 'value');
  let intercepted = 0;
  Object.defineProperty(input, 'value', { get() { return native.get.call(this); }, set() { intercepted++; } });
  const events = [];
  input.addEventListener('input', event => events.push([event.type, event.data]));
  input.addEventListener('change', event => events.push([event.type]));
  const reply = await h.command('tabs.type', { selector: '#composer', text: 'A test, not a login.' });
  assert.equal(reply.ok, true);
  assert.equal(reply.result.method, 'native-value-setter');
  assert.equal(reply.result.value, 'A test, not a login.');
  assert.equal(intercepted, 0);
  assert.deepEqual(events, [['input', 'A test, not a login.'], ['change']]);
  h.close();
});

test('contenteditable fallback and native editing paths preserve text without submitting', async () => {
  for (const native of [false, true]) {
    const h = harness('<div id="composer" contenteditable="true"><p>old</p></div><button id="send">Send</button>');
    let sends = 0;
    h.document.querySelector('#send').onclick = () => { sends++; };
    if (native) h.document.execCommand = (name, ui, value) => { assert.equal(name, 'insertText'); h.document.activeElement.textContent = value; return true; };
    const reply = await h.command('tabs.type', { selector: '#composer', text: 'new text' });
    assert.equal(reply.ok, true);
    assert.equal(reply.result.value, 'new text');
    assert.equal(reply.result.method, native ? 'contenteditable-insertText' : 'contenteditable-dom-input');
    assert.equal(sends, 0);
    h.close();
  }
});

test('typing failure is visible when the page rejects the new value', async () => {
  const h = harness('<textarea id="composer"></textarea>');
  const input = h.document.querySelector('#composer');
  input.addEventListener('input', () => { input.value = ''; });
  const reply = await h.command('tabs.type', { selector: '#composer', text: 'test' });
  assert.equal(reply.ok, false);
  assert.equal(reply.error.code, 'TYPE_NOT_APPLIED');
  h.close();
});

test('hidden, disabled, read-only, password and credential fields are rejected', async () => {
  const h = harness('<input id="hidden" style="display:none"><input id="disabled" disabled><input id="readonly" readonly><input id="password" type="password"><input id="otp" autocomplete="one-time-code">');
  for (const [id, code] of [['hidden', 'ELEMENT_HIDDEN'], ['disabled', 'ELEMENT_DISABLED'], ['readonly', 'ELEMENT_READ_ONLY'], ['password', 'CREDENTIAL_INPUT_FORBIDDEN'], ['otp', 'CREDENTIAL_INPUT_FORBIDDEN']]) {
    const reply = await h.command('tabs.type', { selector: `#${id}`, text: 'placeholder' });
    assert.equal(reply.error.code, code);
    assert.equal(h.document.querySelector(`#${id}`).value, '');
  }
  h.close();
});

test('sender, document token, navigation and deadline guards run before the click', async () => {
  const h = harness('<button id="send">Send</button>');
  let clicks = 0;
  h.document.querySelector('button').onclick = () => { clicks++; };
  assert.equal((await h.command('tabs.click', { selector: '#send' }, {}, { id: 'other' })).error.code, 'SENDER_FORBIDDEN');
  assert.equal((await h.command('tabs.click', { selector: '#send' }, { documentToken: 'other' })).error.code, 'TARGET_CHANGED');
  assert.equal((await h.command('tabs.click', { selector: '#send', deadline: 999 })).error.code, 'COMMAND_EXPIRED');
  h.window.history.pushState(null, '', '/c/another');
  assert.equal((await h.command('tabs.click', { selector: '#send' })).error.code, 'TARGET_CHANGED');
  assert.equal(clicks, 0);
  h.close();
});

test('packaged probes return metadata while arbitrary code and ChatGPT storage access fail', async () => {
  const h = harness('<title>Test page</title><main>Hello</main>');
  const page = await h.command('tabs.eval', { probe: 'page' });
  assert.equal(page.result.title, 'Test page');
  assert.equal((await h.command('tabs.eval', { probe: 'elements', selector: 'main' })).result.tag, 'main');
  assert.equal((await h.command('tabs.eval', { probe: 'page', code: 'document.cookie' })).error.code, 'REMOTE_CODE_FORBIDDEN');
  assert.equal((await h.command('tabs.eval', { probe: 'storage' })).error.code, 'PROBE_FORBIDDEN');
  h.close();
});

test('placeholder storage probe does not return cookies or unrelated data', async () => {
  const h = harness('<main>Fixture</main>', 'http://driver:8080/fixture');
  h.window.localStorage.setItem('kasm_probe', 'container-a');
  h.window.localStorage.setItem('unrelated', 'not returned');
  h.document.cookie = 'private=not-returned';
  const reply = await h.command('tabs.eval', { probe: 'storage' });
  assert.deepEqual(JSON.parse(JSON.stringify(reply.result)), { localStorage: { kasm_probe: 'container-a' } });
  h.close();
});
