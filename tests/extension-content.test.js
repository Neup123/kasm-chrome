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


function layout(h) {
  const boxes=new Map();
  h.window.PointerEvent=h.window.MouseEvent;
  const set=(el,left,top,width,height)=>{
    boxes.set(el,{left,top,width,height,right:left+width,bottom:top+height});
    el.getBoundingClientRect=()=>boxes.get(el);
  };
  h.document.elementFromPoint=(x,y)=>Array.from(boxes).reverse().find(([el,r])=>el.isConnected&&x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom)?.[0]||null;
  return set;
}

function approvalHarness(label='Allow GitHub for this conversation',onPointerDown=false) {
  const h=harness('<section><div role="alert"><strong>Allow ChatGPT to use GitHub?</strong><p>Read repository information.</p></div><form><button type="button" id="once">Allow once</button><button type="button" aria-label="Approval options">Options</button></form></section>');
  const place=layout(h);
  const trigger=h.document.querySelector('[aria-label="Approval options"]');
  place(h.document.querySelector('#once'),10,10,80,20);place(trigger,90,10,20,20);
  let once=0,full=0,opened=0;
  h.document.querySelector('#once').onclick=()=>once++;
  const open=e=>{
    if(e.clientX<103)return; // only the chevron end opens the menu
    if(onPointerDown) e.preventDefault();
    opened++; const menu=h.document.createElement('div');menu.setAttribute('role','menu');menu.dataset.state='open';
    menu.innerHTML='<button role="menuitem">Allow once</button><button role="menuitem"></button>';
    menu.lastChild.textContent=label;
    menu.firstChild.onclick=()=>once++;
    menu.lastChild.onclick=()=>{full++;h.document.querySelector('section').remove();menu.remove();};
    h.document.body.append(menu);
    place(menu.firstChild,80,40,100,20);place(menu.lastChild,80,60,100,20);
    if(onPointerDown) h.document.querySelector('section').setAttribute('aria-hidden','true');
  };
  if(onPointerDown) trigger.addEventListener('pointerdown',open);
  trigger.addEventListener('click',open);
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
  const place=layout(h);place(button,10,100,100,20);
  button.onclick=()=>{
    const popup=h.document.createElement('section');popup.dataset.state='open';
    popup.innerHTML='<div id="track"></div><div><span>Low</span><span>Medium</span><span>High</span></div>';
    h.document.body.append(popup);
    const track=popup.querySelector('#track');place(track,10,10,200,8);
    popup.querySelectorAll('span').forEach((e,i)=>place(e,i*90+10,30,20,15));
    track.onpointerup=null;
    track.addEventListener('pointerup',e=>{if(e.clientX>170)button.textContent='High';popup.remove();});
  };
  const r=await h.command('tabs.setEffort',{effort:'High'});
  assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.result.verified,true);
  assert.equal((await h.command('tabs.setEffort',{effort:'High'})).result.changed,false);h.close();
});
test('accessible Ask ChatGPT composer without form or test ID opens picker and verifies drag',async()=>{
  const h=harness('<main><div><div><div contenteditable="true" aria-label="Ask ChatGPT"></div></div><div><button type="button" aria-label="Thinking effort">Medium</button></div></div></main>');
  const button=h.document.querySelector('button');
  const place=layout(h);place(button,10,100,100,20);
  button.onclick=()=>{
    const popup=h.document.createElement('section');popup.dataset.state='open';
    popup.innerHTML='<div id="track"></div><div><span>Low</span><span>Medium</span><span>High</span></div>';
    h.document.body.append(popup);
    const track=popup.querySelector('#track');place(track,10,10,200,8);
    popup.querySelectorAll('span').forEach((e,i)=>place(e,i*90+10,30,20,15));
    track.onpointerup=null;
    track.addEventListener('pointerup',e=>{if(e.clientX>170)button.textContent='High';popup.remove();});
  };
  const r=await h.command('tabs.setEffort',{effort:'High'});
  assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.result.verified,true);
  assert.equal((await h.command('tabs.setEffort',{effort:'High'})).result.changed,false);h.close();
});
test('accessible composer rejects multiple visible anchors without clicking',async()=>{
  const h=harness('<div><div contenteditable="true" aria-label="Ask ChatGPT"></div><div contenteditable="true" aria-label="Ask ChatGPT"></div><button aria-label="Thinking effort">High</button></div>');
  let clicks=0;h.document.querySelector('button').onclick=()=>clicks++;
  assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_COMPOSER_AMBIGUOUS');
  assert.equal(clicks,0);h.close();
});
test('accessible composer ignores hidden duplicates and never scans main for unrelated effort labels',async()=>{
  const h=harness('<main><div hidden contenteditable="true" aria-label="Ask ChatGPT"></div><div><div contenteditable="true" aria-label="Ask ChatGPT"></div></div><button aria-label="Thinking effort">High</button></main>');
  let clicks=0;h.document.querySelector('button').onclick=()=>clicks++;
  assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_PICKER_NOT_UNIQUE');
  assert.equal(clicks,0);h.close();
});
test('accessible composer rejects ambiguous local controls and accepts hidden duplicate anchor',async()=>{
  const h=harness('<div><div hidden id="prompt-textarea"></div><div contenteditable="true" aria-label="Ask ChatGPT"></div><button aria-label="Thinking effort">High</button><button aria-label="Thinking effort">Medium</button></div>');
  assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_PICKER_NOT_UNIQUE');
  h.document.querySelectorAll('button')[1].remove();
  assert.deepEqual((await h.command('tabs.setEffort',{effort:'High'})).result,{effort:'High',changed:false,verified:true});h.close();
});
test('ChatGPT-only controls fail on fixture, probes remain read-only',async()=>{
  const h=harness('<main>fixture</main>','http://driver:8080/fixtures/session');
  assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'URL_FORBIDDEN');
  assert.equal((await h.command('tabs.approve',{service:'GitHub'})).error.code,'URL_FORBIDDEN');h.close();
});

test('coordinate inspection gives hit and ancestor geometry, then exact off-center event sequence',async()=>{
  const h=harness('<button id="pill">Allow once <span id="chevron" aria-label="Options">v</span></button><button id="outside">Outside</button>');
  const place=layout(h),pill=h.document.querySelector('#pill'),chevron=h.document.querySelector('#chevron');
  place(pill,10,10,100,20);place(chevron,95,10,15,20);place(h.document.querySelector('#outside'),-100,10,10,10);
  const events=[]; for(const n of ['pointermove','pointerdown','mousedown','pointerup','mouseup','click'])chevron.addEventListener(n,e=>events.push([e.type,e.clientX,e.clientY,e.isTrusted]));
  const map=await h.command('tabs.mapInteractive');
  assert.equal(map.result.elements.length,1);assert.equal(map.result.elements[0].rect.width,100);
  const inspect=await h.command('tabs.inspectAt',{x:105,y:20});
  assert.equal(inspect.result.element.ariaLabel,'Options');assert.equal(inspect.result.ancestors[0].tag,'button');
  assert.equal(events.length,0);
  const fields={x:105,y:20,inspectionId:inspect.result.inspectionId};
  assert.equal((await h.command('tabs.clickAt',fields)).result.dispatched,true);
  assert.deepEqual(events,['pointermove','pointerdown','mousedown','pointerup','mouseup','click'].map(n=>[n,105,20,false]));
  assert.equal((await h.command('tabs.clickAt',fields)).error.code,'INSPECTION_REQUIRED');
  h.close();
});
test('coordinate clicks reject changed, covered or uninspected targets and credentials',async()=>{
  const h=harness('<button id="target">Original</button><button id="overlay" hidden>Overlay</button><input id="pw" type="password">');
  const place=layout(h),target=h.document.querySelector('#target'),overlay=h.document.querySelector('#overlay');
  place(target,10,10,100,20);place(h.document.querySelector('#pw'),10,50,100,20);
  let clicks=0;target.onclick=()=>clicks++;overlay.onclick=()=>clicks++;
  const get=async()=>({x:20,y:20,inspectionId:(await h.command('tabs.inspectAt',{x:20,y:20})).result.inspectionId});
  let fields=await get();assert.equal((await h.command('tabs.clickAt',{...fields,x:21})).error.code,'POINT_NOT_INSPECTED');
  fields=await get();target.textContent='Changed';assert.equal((await h.command('tabs.clickAt',fields)).error.code,'POINT_TARGET_CHANGED');
  fields=await get();overlay.hidden=false;place(overlay,10,10,100,20);assert.equal((await h.command('tabs.clickAt',fields)).error.code,'POINT_TARGET_CHANGED');
  assert.equal((await h.command('tabs.inspectAt',{x:20,y:60})).error.code,'CREDENTIAL_INPUT_FORBIDDEN');
  assert.equal((await h.command('tabs.inspectAt',{x:9999,y:20})).error.code,'POINT_OUTSIDE_VIEWPORT');
  assert.equal(clicks,0);h.close();
});
test('coordinate commands deny internal fixture and arbitrary code',async()=>{
  const h=harness('<button>Fixture</button>','http://driver:8080/fixtures/session');
  for(const [cmd,fields] of [['tabs.inspectAt',{x:1,y:1}],['tabs.clickAt',{x:1,y:1,inspectionId:'a'.repeat(32)}],['tabs.mapInteractive',{}]])
    assert.equal((await h.command(cmd,fields)).error.code,'URL_FORBIDDEN');
  h.close();
});

test('pointerdown-only menu with modal focus trap opens once and preserves exact approval binding',async()=>{
  const h=approvalHarness('Allow GitHub for this conversation',true);
  const r=await h.command('tabs.approve',{service:'GitHub'});
  assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.result.approved,true);
  assert.deepEqual(h.counts(),[0,1,1]);h.close();
});
test('interactive map includes role-less drag affordances, implicit roles and excludes credential/offscreen targets',async()=>{
  const h=harness('<button>Button</button><div id="track" style="cursor:ew-resize">Track</div><input type="password"><button id="hidden" style="display:none">Hidden</button>');
  const place=layout(h);
  Array.from(h.document.body.children).forEach((el,i)=>place(el,10,10+i*30,100,20));
  const r=await h.command('tabs.mapInteractive');
  assert.equal(r.ok,true);assert.deepEqual(r.result.elements.map(e=>[e.role,e.text]),[['button','Button'],[null,'Track']]);h.close();
});

function freshEffortHarness(markup) {
  const h=harness(markup);
  const place=layout(h);
  const button=h.document.querySelector('#effort');
  let opened=0;
  place(button,10,100,100,20);
  button.onclick=()=>{
    opened++;
    const popup=h.document.createElement('section');popup.dataset.state='open';
    popup.innerHTML='<div id="track"></div><div><span>Low</span><span>Medium</span><span>High</span></div>';
    h.document.body.append(popup);
    const track=popup.querySelector('#track');place(track,10,10,200,8);
    popup.querySelectorAll('span').forEach((el,i)=>place(el,i*90+10,30,20,15));
    track.addEventListener('pointerup',e=>{if(e.clientX>170)button.textContent='High';popup.remove();});
  };
  return {...h,opened:()=>opened};
}
test('fresh composer with an editor form and sibling named effort control verifies High',async()=>{
  const h=freshEffortHarness('<main><section><form><div contenteditable="true" aria-label="Ask ChatGPT"></div></form><div><button id="effort" type="button" aria-label="Thinking effort">Medium</button></div></section></main>');
  try {
    const reply=await h.command('tabs.setEffort',{effort:'High'});
    assert.deepEqual(reply.result,{effort:'High',previous:'Medium',changed:true,verified:true},JSON.stringify(reply));
    assert.equal(h.opened(),1);
    assert.deepEqual((await h.command('tabs.setEffort',{effort:'High'})).result,{effort:'High',changed:false,verified:true});
    assert.equal(h.opened(),1);
  } finally {h.close();}
});
test('fresh explicit composer test ID with sibling named effort control verifies High',async()=>{
  const h=freshEffortHarness('<main><section><div data-testid="composer"><div contenteditable="true" aria-label="Ask ChatGPT"></div></div><div><button id="effort" aria-label="Thinking effort">Medium</button></div></section></main>');
  try {
    const reply=await h.command('tabs.setEffort',{effort:'High'});
    assert.deepEqual(reply.result,{effort:'High',previous:'Medium',changed:true,verified:true},JSON.stringify(reply));
    assert.equal(h.opened(),1);
  } finally {h.close();}
});
test('fresh explicit composer fallback rejects a bare level label',async()=>{
  const h=freshEffortHarness('<main><section><form><div contenteditable="true" aria-label="Ask ChatGPT"></div></form><button id="effort">High</button></section></main>');
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_PICKER_NOT_UNIQUE');
    assert.equal(h.opened(),0);
  } finally {h.close();}
});
test('fresh explicit composer fallback rejects multiple named effort controls',async()=>{
  const h=freshEffortHarness('<main><section><form><div contenteditable="true" aria-label="Ask ChatGPT"></div></form><button id="effort" aria-label="Thinking effort">Medium</button><button aria-label="Thinking effort">High</button></section></main>');
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_PICKER_NOT_UNIQUE');
    assert.equal(h.opened(),0);
  } finally {h.close();}
});
test('fresh explicit composer fallback never crosses a main landmark or another editor',async()=>{
  const h=freshEffortHarness('<main><section><form><div contenteditable="true" aria-label="Ask ChatGPT"></div></form></section><button id="effort" aria-label="Thinking effort">High</button></main>');
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_PICKER_NOT_UNIQUE');
    const section=h.document.querySelector('section');
    section.append(h.document.querySelector('#effort'));
    const other=h.document.createElement('textarea');section.append(other);
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_COMPOSER_AMBIGUOUS');
    assert.equal(h.opened(),0);
  } finally {h.close();}
});
test('fresh explicit composer fallback rejects controls in another form or dialog',async()=>{
  const h=freshEffortHarness('<main><section><form><div contenteditable="true" aria-label="Ask ChatGPT"></div></form><form><button id="effort" aria-label="Thinking effort">High</button></form></section></main>');
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_PICKER_NOT_UNIQUE');
    const other=h.document.querySelectorAll('form')[1];
    const dialog=h.document.createElement('div');dialog.setAttribute('role','dialog');
    dialog.append(h.document.querySelector('#effort'));other.replaceWith(dialog);
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_PICKER_NOT_UNIQUE');
    assert.equal(h.opened(),0);
  } finally {h.close();}
});

function fiveTickHarness({current='Medium', labels=['Minimal','Low','Medium','High','Extra High'], fullTrack=true, partialTrack=false, update='High', markup='<form><div id="prompt-textarea"></div><button type="button" aria-label="Thinking effort"></button></form>'}={}) {
  const h=harness(markup);
  const button=h.document.querySelector('button');
  button.textContent=current;
  const place=layout(h);place(button,10,100,100,20);
  let opens=0;const releases=[];
  button.onclick=()=>{
    opens++;
    const popup=h.document.createElement('section');popup.dataset.state='open';
    popup.innerHTML='<div id="full"></div><div id="partial"></div><div id="ticks"></div>';
    h.document.body.append(popup);
    const ticks=popup.querySelector('#ticks');
    labels.forEach((label,i)=>{
      const el=h.document.createElement('span');el.textContent=label;ticks.append(el);
      place(el,10+i*60,40,20,15);
    });
    const full=popup.querySelector('#full'), partial=popup.querySelector('#partial');
    if(fullTrack) place(full,10,10,260,8);else full.remove();
    // A plausible nearer partial track spans only Low, Medium, High.
    if(partialTrack) place(partial,70,25,140,8);else partial.remove();
    for(const track of [full,partial])track.addEventListener('pointerup',e=>{
      releases.push({track:track.id,x:e.clientX});button.textContent=update;popup.remove();
    });
  };
  return {...h,opens:()=>opens,releases};
}
test('five-tick effort identifies the full track and exact High tick instead of the nearer partial track',async()=>{
  const h=fiveTickHarness({partialTrack:true});
  try {
    const reply=await h.command('tabs.setEffort',{effort:'High'});
    assert.deepEqual(reply.result,{effort:'High',previous:'Medium',changed:true,verified:true},JSON.stringify(reply));
    assert.deepEqual(h.releases,[{track:'full',x:200}]);
    assert.deepEqual((await h.command('tabs.setEffort',{effort:'High'})).result,{effort:'High',changed:false,verified:true});
    assert.equal(h.opens(),1);
  } finally {h.close();}
});
test('five-tick effort rejects a partial track when no track spans the whole row',async()=>{
  const h=fiveTickHarness({fullTrack:false,partialTrack:true});
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_TRACK_NOT_FOUND');
    assert.deepEqual(h.releases,[]);
  } finally {h.close();}
});
test('Extra High is not verified as High and must not trigger a drag',async()=>{
  const h=fiveTickHarness({current:'Extra High'});
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_CURRENT_UNKNOWN');
    assert.equal(h.opens(),0);assert.deepEqual(h.releases,[]);
  } finally {h.close();}
});
test('five-tick effort rejects an unsupported level interleaved between supported ticks',async()=>{
  const h=fiveTickHarness({labels:['Low','Medium','Intermediate','High','Extra High']});
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_GEOMETRY_UNVERIFIED');
    assert.deepEqual(h.releases,[]);
  } finally {h.close();}
});
test('five-tick effort rejects duplicate extra tick labels',async()=>{
  const h=fiveTickHarness({labels:['Extra','Low','Medium','High','Extra']});
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error.code,'EFFORT_TICKS_NOT_UNIQUE');
    assert.deepEqual(h.releases,[]);
  } finally {h.close();}
});
test('five-tick effort does not treat Extra High readback as successful High',async()=>{
  const h=fiveTickHarness({update:'Extra High'});
  try {
    const reply=await h.command('tabs.setEffort',{effort:'High'});
    assert.equal(reply.error?.code,'EFFORT_NOT_APPLIED',JSON.stringify(reply));
    assert.deepEqual(h.releases,[{track:'full',x:200}]);
  } finally {h.close();}
});

const siblingFormFiveTicks='<main><section><form><div contenteditable="true" aria-label="Ask ChatGPT"></div></form><div><button type="button" aria-label="Thinking effort"></button></div></section></main>';
const siblingTestIdFiveTicks='<main><section><div data-testid="composer"><div contenteditable="true" aria-label="Ask ChatGPT"></div></div><div><button type="button" aria-label="Thinking effort"></button></div></section></main>';
test('combined fresh form sibling and five ticks choose the full track and verify High exactly once',async()=>{
  const h=fiveTickHarness({markup:siblingFormFiveTicks,partialTrack:true});
  try {
    assert.deepEqual((await h.command('tabs.setEffort',{effort:'High'})).result,{effort:'High',previous:'Medium',changed:true,verified:true});
    assert.deepEqual(h.releases,[{track:'full',x:200}]);
    assert.deepEqual((await h.command('tabs.setEffort',{effort:'High'})).result,{effort:'High',changed:false,verified:true});
    assert.equal(h.opens(),1);
  } finally {h.close();}
});
test('combined fresh test-ID sibling and five ticks choose the full track',async()=>{
  const h=fiveTickHarness({markup:siblingTestIdFiveTicks,partialTrack:true});
  try {
    const reply=await h.command('tabs.setEffort',{effort:'High'});
    assert.deepEqual(reply.result,{effort:'High',previous:'Medium',changed:true,verified:true},JSON.stringify(reply));
    assert.deepEqual(h.releases,[{track:'full',x:200}]);
    assert.equal(h.opens(),1);
  } finally {h.close();}
});
test('combined fresh sibling with only partial five-tick track fails without drag',async()=>{
  const h=fiveTickHarness({markup:siblingFormFiveTicks,fullTrack:false,partialTrack:true});
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_TRACK_NOT_FOUND');
    assert.equal(h.opens(),1);assert.deepEqual(h.releases,[]);
  } finally {h.close();}
});
test('combined fresh sibling with Extra High current label fails without opening picker',async()=>{
  const h=fiveTickHarness({markup:siblingFormFiveTicks,current:'Extra High'});
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_CURRENT_UNKNOWN');
    assert.equal(h.opens(),0);assert.deepEqual(h.releases,[]);
  } finally {h.close();}
});
test('combined fresh sibling five-tick drag rejects Extra High final label',async()=>{
  const h=fiveTickHarness({markup:siblingTestIdFiveTicks,partialTrack:true,update:'Extra High'});
  try {
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_NOT_APPLIED');
    assert.equal(h.opens(),1);assert.deepEqual(h.releases,[{track:'full',x:200}]);
  } finally {h.close();}
});
test('combined fresh sibling with duplicate named controls rejects before picker opens',async()=>{
  const h=fiveTickHarness({markup:siblingFormFiveTicks});
  try {
    const duplicate=h.document.createElement('button');duplicate.setAttribute('aria-label','Thinking effort');duplicate.textContent='Medium';
    h.document.querySelector('section').append(duplicate);
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_PICKER_NOT_UNIQUE');
    assert.equal(h.opens(),0);assert.deepEqual(h.releases,[]);
  } finally {h.close();}
});

function genericEffortHarness({current='Medium',final='High',associated=true,duplicate=false,close=false,preopen=false,triggerText='Thinking effort'}={}) {
  const h=harness('<main><section><form><div contenteditable="true" aria-label="Ask ChatGPT"></div></form><div><button type="button" aria-label="Thinking effort">Thinking effort</button></div></section></main>');
  const button=h.document.querySelector('button');button.textContent=triggerText;
  const place=layout(h);place(button,10,100,100,20);
  if(associated)button.setAttribute('aria-controls','effort-popup');
  let opens=0;const releases=[];
  function open(){
    opens++;
    const popup=h.document.createElement('section');popup.id='effort-popup';popup.dataset.state='open';
    popup.innerHTML='<div id="track" role="slider" aria-label="Thinking effort"></div><div><span>Low</span><span>Medium</span><span>High</span></div>';
    h.document.body.append(popup);
    const track=popup.querySelector('#track');place(track,10,10,200,8);
    if(current!==null)track.setAttribute('aria-valuetext',current);
    popup.querySelectorAll('span').forEach((el,i)=>place(el,10+i*90,30,20,15));
    if(duplicate){const other=track.cloneNode();other.id='other-track';popup.append(other);place(other,10,18,200,8);}
    track.addEventListener('pointerup',e=>{
      releases.push(e.clientX);
      track.setAttribute('aria-valuetext',final);
      if(close)popup.remove();
    });
  }
  button.onclick=open;if(preopen)open();
  return {...h,opens:()=>opens,releases};
}
test('generic Thinking effort identifies current level from associated slider and verifies exact final readback',async()=>{
  const h=genericEffortHarness();
  try{
    const reply=await h.command('tabs.setEffort',{effort:'High'});
    assert.deepEqual(reply.result,{effort:'High',previous:'Medium',changed:true,verified:true},JSON.stringify(reply));
    assert.deepEqual(h.releases,[200]);assert.equal(h.opens(),1);
  }finally{h.close();}
});
test('generic Thinking effort already High is verified without dragging',async()=>{
  const h=genericEffortHarness({current:'High'});
  try{
    assert.deepEqual((await h.command('tabs.setEffort',{effort:'High'})).result,{effort:'High',changed:false,verified:true});
    assert.deepEqual(h.releases,[]);assert.equal(h.opens(),1);
  }finally{h.close();}
});
test('generic Thinking effort with missing slider value fails without drag',async()=>{
  const h=genericEffortHarness({current:null});
  try{
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_CURRENT_UNKNOWN');
    assert.equal(h.opens(),1);assert.deepEqual(h.releases,[]);
  }finally{h.close();}
});
test('generic Thinking effort rejects unsupported slider value without drag',async()=>{
  const h=genericEffortHarness({current:'Extra High'});
  try{
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_CURRENT_UNKNOWN');
    assert.equal(h.opens(),1);assert.deepEqual(h.releases,[]);
  }finally{h.close();}
});
test('generic Thinking effort rejects ambiguous associated sliders without drag',async()=>{
  const h=genericEffortHarness({duplicate:true});
  try{
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_CURRENT_UNKNOWN');
    assert.equal(h.opens(),1);assert.deepEqual(h.releases,[]);
  }finally{h.close();}
});
test('generic Thinking effort does not use a preexisting unassociated popup',async()=>{
  const h=genericEffortHarness({associated:false,preopen:true});
  try{
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_CURRENT_UNKNOWN');
    assert.equal(h.opens(),1);assert.deepEqual(h.releases,[]);
  }finally{h.close();}
});
test('generic Thinking effort refuses false Extra High slider readback',async()=>{
  const h=genericEffortHarness({final:'Extra High'});
  try{
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_NOT_APPLIED');
    assert.deepEqual(h.releases,[200]);
  }finally{h.close();}
});
test('generic Thinking effort cannot verify a closed popup with unchanged generic trigger',async()=>{
  const h=genericEffortHarness({close:true});
  try{
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_NOT_APPLIED');
    assert.deepEqual(h.releases,[200]);
  }finally{h.close();}
});
test('explicit unsupported current label cannot use generic fallback',async()=>{
  const h=genericEffortHarness({triggerText:'Extra High'});
  try{
    assert.equal((await h.command('tabs.setEffort',{effort:'High'})).error?.code,'EFFORT_CURRENT_UNKNOWN');
    assert.equal(h.opens(),0);assert.deepEqual(h.releases,[]);
  }finally{h.close();}
});
