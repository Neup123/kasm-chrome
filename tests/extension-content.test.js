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

test('content-script bootstrap supports internal HTTP and scopes its random binding to one document', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../extension/content'), 'utf8');
  const url = 'http://driver:8080/fixtures/session';
  const createDocument = () => {
    const dom = new JSDOM('<main>Fixture</main>', { url, runScripts: 'outside-only' });
    const { window } = dom;
    Object.defineProperty(window.crypto, 'randomUUID', { value: undefined });
    window.KasmProtocol = protocol;
    let listeners = 0;
    window.browser = { runtime: { id: protocol.EXTENSION_ID, onMessage: { addListener: () => listeners++ } } };
    return { window, listeners: () => listeners, close: () => window.close() };
  };
  const a = createDocument(), b = createDocument();
  try {
    const first = a.window.eval(source);
    assert.equal(first.url, url);
    assert.match(first.documentToken, /^[a-f0-9]{32}$/);
    assert.equal(a.window.eval(source).documentToken, first.documentToken);
    assert.equal(a.listeners(), 1);
    assert.notEqual(b.window.eval(source).documentToken, first.documentToken);
  } finally {
    a.close();
    b.close();
  }
});

function approvalHarness(label='Allow GitHub for this conversation') {
  const h=harness('<section><div role="alert"><strong>Allow ChatGPT to use GitHub?</strong><p>Read repository information.</p></div><form><button type="button" id="once">Allow once</button><button type="button" aria-label="Approval options">Options</button></form></section>');
  let once=0,full=0,opened=0;
  h.document.querySelector('#once').onclick=()=>once++;
  h.document.querySelector('[aria-label="Approval options"]').onclick=()=>{
    opened++; const menu=h.document.createElement('div');menu.setAttribute('role','menu');menu.dataset.state='open';
    menu.innerHTML='<button role="menuitem">Allow once</button><button role="menuitem"></button>';
    menu.lastChild.textContent=label;
    menu.firstChild.onclick=()=>once++;
    menu.lastChild.onclick=()=>{full++;h.document.querySelector('section').remove();menu.remove();};
    h.document.body.append(menu);
  };
  return {...h,counts:()=>[once,full,opened]};
}
test('approval inspection is read-only and full conversation grant checks exact label',async()=>{
  const h=approvalHarness();
  const inspected=await h.command('tabs.approve');
  assert.deepEqual(inspected.result,{found:true,approved:false,question:'Allow ChatGPT to use GitHub?',description:'Read repository information.'});
  assert.deepEqual(h.counts(),[0,0,0]);
  assert.equal((await h.command('tabs.approve',{service:'Coolify'})).error.code,'APPROVAL_SERVICE_MISMATCH');
  const granted=await h.command('tabs.approve',{service:'GitHub'});
  assert.equal(granted.result.approved,true);assert.equal(granted.result.scope,'conversation');
  assert.deepEqual(h.counts(),[0,1,1]);
  assert.deepEqual((await h.command('tabs.approve',{service:'GitHub'})).result,{found:false,approved:false});
  h.close();
});
test('approval rejects wrong second menu item rather than granting once',async()=>{
  const h=approvalHarness('Allow once');
  assert.equal((await h.command('tabs.approve',{service:'GitHub'})).error.code,'APPROVAL_OPTION_NOT_VERIFIED');
  assert.deepEqual(h.counts(),[0,0,1]);h.close();
});
test('keyboard dispatch sends bounded events to focus without touching credentials',async()=>{
  const h=harness('<input id="input"><input id="pw" type="password">');
  const input=h.document.querySelector('#input');input.focus();const seen=[];
  for(const name of ['keydown','keyup'])input.addEventListener(name,e=>{seen.push([e.type,e.key,e.ctrlKey,e.shiftKey,e.isTrusted]);e.preventDefault();});
  const r=await h.command('tabs.key',{key:'Ctrl+Shift+M'});
  assert.deepEqual(seen,[['keydown','M',true,true,false],['keyup','M',true,true,false]]);
  assert.equal(r.result.defaultPrevented,true);
  h.document.querySelector('#pw').focus();
  assert.equal((await h.command('tabs.key',{key:'Enter'})).error.code,'CREDENTIAL_INPUT_FORBIDDEN');h.close();
});
test('effort picker opens, uses role-less drag track and verifies composer label',async()=>{
  const h=harness('<form><div id="prompt-textarea"></div><button type="button" aria-label="Thinking effort">Medium</button></form>');
  const button=h.document.querySelector('button');
  const rectangle=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  h.window.PointerEvent=h.window.MouseEvent;
  button.onclick=()=>{
    const popup=h.document.createElement('section');popup.dataset.state='open';
    popup.innerHTML='<div id="track"></div><div><span>Low</span><span>Medium</span><span>High</span></div>';
    h.document.body.append(popup);
    const track=popup.querySelector('#track');track.getBoundingClientRect=()=>rectangle(10,10,200,8);
    popup.querySelectorAll('span').forEach((e,i)=>e.getBoundingClientRect=()=>rectangle(i*90+10,30,20,15));
    track.onpointerup=null;
    track.addEventListener('pointerup',e=>{if(e.clientX>170)button.textContent='High';popup.remove();});
  };
  const r=await h.command('tabs.setEffort',{effort:'High'});
  assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.result.verified,true);
  assert.equal((await h.command('tabs.setEffort',{effort:'High'})).result.changed,false);h.close();
});
test('ChatGPT-only controls fail on fixture, probes remain read-only',async()=>{
  const h=harness('<main>fixture</main>','http://driver:8080/fixtures/session');
  assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'URL_FORBIDDEN');
  assert.equal((await h.command('tabs.approve',{service:'GitHub'})).error.code,'URL_FORBIDDEN');h.close();
});
