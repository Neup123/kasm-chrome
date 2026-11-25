'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const protocol = require('../extension/protocol');

test('origin allowlist rejects lookalikes, alternate ports and credentials', () => {
  for (const url of ['https://chatgpt.com/', 'http://driver:8080/fixtures/session']) assert.equal(protocol.isAllowedUrl(url), true);
  for (const url of ['http://chatgpt.com/', 'https://chatgpt.com.evil.test/', 'https://a.chatgpt.com/', 'https://chatgpt.com:444/', 'https://user@chatgpt.com/', 'http://driver/', 'http://driver:8081/', 'file:///etc/passwd', 'about:blank', 'javascript:alert(1)']) assert.equal(protocol.isAllowedUrl(url), false, url);
});

test('every tab command requires exact container, bounded data and correct fields', () => {
  const base = {id:'test-1',cmd:'tabs.type',tabId:3,container:'ChatGPT 1',selector:'#prompt-textarea',text:'A small test'};
  assert.deepEqual(protocol.validateCommand(base), base);
  for (const changed of [{container:''}, {container:' ChatGPT 1'}, {container:undefined}, {tabId:-1}, {selector:''}, {text:'x'.repeat(protocol.LIMITS.maxTextLength+1)}, {text:123}, {clear:'yes'}]) {
    assert.throws(() => protocol.validateCommand({...base,...changed}), protocol.ProtocolError);
  }
  assert.throws(() => protocol.validateCommand({...base,apiKey:'must-never-forward'}), /Unexpected/);
});

test('arbitrary code cannot use the diagnostic probe command', () => {
  const base={id:'eval-1',cmd:'tabs.eval',container:'ChatGPT 1',tabId:4,probe:'page'};
  assert.equal(protocol.validateCommand(base).probe, 'page');
  for(const key of ['code','script','expression','expr']) assert.throws(()=>protocol.validateCommand({...base,[key]:'fetch("https://evil.test")'}),{code:'REMOTE_CODE_FORBIDDEN'});
  assert.throws(()=>protocol.validateCommand({...base,probe:'cookies'}), protocol.ProtocolError);
});

test('IDs, deadlines and timeouts reject invalid wire values', () => {
  const base={id:'list-1',cmd:'containers.list'};
  for(const change of [{id:'new\nline'},{id:'__bad'},{deadline:NaN},{timeoutMs:60001},{timeoutMs:99},{container:'ChatGPT 1'}]) assert.throws(()=>protocol.validateCommand({...base,...change}),protocol.ProtocolError);
});
