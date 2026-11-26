'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const protocol = require('../extension/protocol');
const { createRouter } = require('../extension/core');

function harness() {
  const identities = [{ name: 'ChatGPT 1', cookieStoreId: 'firefox-container-1', color: 'blue', icon: 'fingerprint' },
    { name: 'ChatGPT 2', cookieStoreId: 'firefox-container-2', color: 'orange', icon: 'fingerprint' }];
  const tabs = new Map([
    [11, { id: 11, cookieStoreId: 'firefox-container-1', url: 'https://chatgpt.com/', title: 'ChatGPT', status: 'complete' }],
    [22, { id: 22, cookieStoreId: 'firefox-container-2', url: 'https://chatgpt.com/', title: 'ChatGPT', status: 'complete' }],
    [33, { id: 33, cookieStoreId: 'firefox-default', url: 'https://chatgpt.com/' }],
    [44, { id: 44, cookieStoreId: 'firefox-container-1', url: 'https://example.com/' }]
  ]);
  const calls = [];
  let nextContainer = 3;
  let nextTab = 100;
  const browser = {
    contextualIdentities: {
      query: async ({ name } = {}) => identities.filter(item => name === undefined || item.name === name),
      create: async args => {
        calls.push(['createContainer', args]);
        await Promise.resolve();
        const item = { ...args, cookieStoreId: `firefox-container-${nextContainer++}` };
        identities.push(item); return item;
      },
      update: async (id, args) => { const item = identities.find(item => item.cookieStoreId === id); Object.assign(item, args); return item; }
    },
    tabs: {
      get: async id => { if (!tabs.has(id)) throw Error('missing'); return { ...tabs.get(id) }; },
      query: async ({ cookieStoreId }) => [...tabs.values()].filter(tab => tab.cookieStoreId === cookieStoreId),
      create: async args => { calls.push(['createTab', args]); const item = { ...args, id: nextTab++ }; tabs.set(item.id, item); return item; },
      update: async (id, args) => { calls.push(['updateTab', id, args]); Object.assign(tabs.get(id), args); return { ...tabs.get(id) }; },
      remove: async id => { calls.push(['removeTab', id]); tabs.delete(id); },
      executeScript: async (id, args) => { calls.push(['inject', id, args]); return [{ documentToken: 'document-1', url: tabs.get(id).url }]; },
      sendMessage: async (id, args) => { calls.push(['send', id, args]); return { ok: true, result: { text: 'fixture' } }; }
    }
  };
  let clock = 1000;
  const router = createRouter(browser, protocol, { now: () => clock });
  return { browser, router, calls, identities, tabs, tick: value => { clock = value; } };
}

const request = (cmd, fields = {}) => ({ id: 'test-command', cmd, container: 'ChatGPT 1', deadline: 10000, ...fields });

test('concurrent ensure calls create a named identity once and update intentionally', async () => {
  const h = harness();
  const result = await Promise.all([
    h.router.dispatch(request('containers.ensure', { container: 'New container', color: 'green' })),
    h.router.dispatch(request('containers.ensure', { id: 'second', container: 'New container', icon: 'briefcase' }))
  ]);
  assert.equal(h.calls.filter(call => call[0] === 'createContainer').length, 1);
  assert.equal(result[0].cookieStoreId, result[1].cookieStoreId);
  assert.equal(result[1].icon, 'briefcase');
  assert.equal(result[1].color, 'green');
});

test('ambiguous names fail instead of selecting an arbitrary cookie store', async () => {
  const h = harness();
  h.identities.push({ ...h.identities[0], cookieStoreId: 'firefox-container-5' });
  await assert.rejects(h.router.dispatch(request('tabs.create', { url: 'https://chatgpt.com/' })), { code: 'CONTAINER_AMBIGUOUS' });
  assert.equal(h.calls.length, 0);
});

test('tabs are created in exact container and inventory excludes other origins and stores', async () => {
  const h = harness();
  const created = await h.router.dispatch(request('tabs.create', { container: 'ChatGPT 2', url: 'https://chatgpt.com/' }));
  assert.equal(created.cookieStoreId, 'firefox-container-2');
  assert.equal(h.calls[0][1].cookieStoreId, 'firefox-container-2');
  const listed = await h.router.dispatch(request('tabs.list'));
  assert.deepEqual(listed.map(tab => tab.tabId), [11]);
});

test('cross-container, default-store, and outside-origin tab actions are rejected', async () => {
  const h = harness();
  for (const tabId of [22, 33]) {
    await assert.rejects(h.router.dispatch(request('tabs.click', { tabId, selector: 'button' })), { code: 'CONTAINER_MISMATCH' });
  }
  await assert.rejects(h.router.dispatch(request('tabs.close', { tabId: 44 })), { code: 'URL_FORBIDDEN' });
  assert.equal(h.calls.length, 0);
});

test('packaged DOM commands bind to a document token and preserve explicit deadline', async () => {
  const h = harness();
  const result = await h.router.dispatch(request('tabs.readText', { tabId: 11 }));
  assert.equal(result.text, 'fixture');
  assert.deepEqual(h.calls.filter(c => c[0] === 'inject').map(c => c[2].file), ['/protocol.js', '/content.js']);
  const sent = h.calls.find(c => c[0] === 'send')[2];
  assert.equal(sent.documentToken, 'document-1');
  assert.equal(sent.expectedUrl, 'https://chatgpt.com/');
  assert.equal(sent.command.deadline, 10000);
});

test('navigation during injection is rejected before any DOM action', async () => {
  const h = harness();
  const inject = h.browser.tabs.executeScript;
  h.browser.tabs.executeScript = async (id, args) => {
    const result = await inject(id, args);
    if (args.file === '/content.js') h.tabs.get(id).url = 'https://chatgpt.com/c/changed';
    return result;
  };
  await assert.rejects(h.router.dispatch(request('tabs.click', { tabId: 11, selector: 'button' })), { code: 'TARGET_CHANGED' });
  assert.equal(h.calls.some(c => c[0] === 'send'), false);
});

test('pending navigation, expired commands, and stale connections cannot mutate tabs', async () => {
  const h = harness();
  h.tabs.get(11).pendingUrl = 'https://chatgpt.com/c/new';
  await assert.rejects(h.router.dispatch(request('tabs.close', { tabId: 11 })), { code: 'TARGET_CHANGED' });
  await assert.rejects(h.router.dispatch(request('tabs.close', { tabId: 11, deadline: 999 })), { code: 'COMMAND_EXPIRED' });
  await assert.rejects(h.router.dispatch(request('tabs.close', { tabId: 11 }), { isCurrent: () => false }), { code: 'CONNECTION_CHANGED' });
  assert.equal(h.calls.length, 0);
});

test('all tab commands require a named container and arbitrary source is forbidden', async () => {
  const h = harness();
  await assert.rejects(h.router.dispatch({ id: 'a', cmd: 'tabs.list', deadline: 10000 }), { code: 'INVALID_COMMAND' });
  await assert.rejects(h.router.dispatch(request('tabs.eval', { tabId: 11, code: 'document.cookie' })), { code: 'REMOTE_CODE_FORBIDDEN' });
  assert.equal(h.calls.length, 0);
});

test('commands queued behind an ongoing action check connection ownership again before starting', async () => {
  const h = harness();
  const query = h.browser.contextualIdentities.query;
  let release;
  let firstQuery = true;
  h.browser.contextualIdentities.query = async args => {
    if (firstQuery) { firstQuery = false; await new Promise(resolve => { release = resolve; }); }
    return query(args);
  };
  const first = h.router.dispatch(request('tabs.list'));
  let live = true;
  const second = h.router.dispatch(request('tabs.close', { id: 'second', tabId: 11 }), { isCurrent: () => live });
  const rejected = assert.rejects(second, { code: 'CONNECTION_CHANGED' });
  await new Promise(resolve => setImmediate(resolve));
  live = false;
  release();
  await first;
  await rejected;
  assert.equal(h.calls.some(c => c[0] === 'removeTab'), false);
});

test('new commands route only to explicit named container and document', async()=>{
  for(const [cmd,fields] of [['tabs.setEffort',{effort:'High'}],['tabs.approve',{service:'GitHub'}],['tabs.key',{key:'Escape'}]]) {
    const h=harness();
    await assert.rejects(h.router.dispatch(request(cmd,{tabId:22,...fields})),{code:'CONTAINER_MISMATCH'});
    assert.equal(h.calls.length,0);
    await h.router.dispatch(request(cmd,{tabId:11,...fields}));
    const sent=h.calls.find(c=>c[0]==='send');
    assert.equal(sent[1],11); assert.equal(sent[2].command.cmd,cmd);
    assert.equal(sent[2].expectedUrl,'https://chatgpt.com/');
  }
});
