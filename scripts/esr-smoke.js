'use strict';
// Run inside the isolated driver container, with its existing synthetic API key.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const key = fs.readFileSync('/run/secrets/driver_api_key','utf8').trim();
const base = 'http://127.0.0.1:8080/agent-driver/v1';
async function request(path, body, authenticated = true) {
  const headers = {'Content-Type':'application/json'};
  if (authenticated) headers['X-API-Key'] = key;
  const response = await fetch(base+path,{headers,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(65000)});
  return {status:response.status,body:await response.json()};
}
async function command(cmd, params={}) {
  const r = await request('/commands',{cmd,...params});
  assert.equal(r.body.ok,true,cmd+' '+(r.body.error?.code||''));
  return r.body.result;
}
async function until(fn, label, ms=120000) {
  const end = Date.now()+ms;
  while(Date.now()<end) {
    try {const v=await fn();if(v)return v;} catch {}
    await new Promise(r=>setTimeout(r,1000));
  }
  throw new Error('Timed out: '+label);
}
async function ready() {
  return until(async()=>{
    const r=await request('/status');
    return r.body.result?.bridge?.state==='ready'&&r.body.result.bridge.extensionVersion===process.argv[2];
  },'policy-installed unsigned extension ready');
}
const fixture='http://driver:8080/fixtures/session';
async function read(container,tabId,marker) {
  return until(async()=>{
    const r=await command('tabs.readText',{container,tabId});
    return r.text.includes(marker)&&r.text;
  },marker,30000);
}
async function main(){
  await ready();
  console.log('PASS: unsigned '+process.argv[2]+' policy install and live bridge');
  assert.equal((await request('/status',null,false)).status,401);
  console.log('PASS: API authentication');
  const identityPath='/tmp/esr-smoke-identities.json';
  let a,b;
  if(process.argv.includes('--after-restart')){
    const expected=JSON.parse(fs.readFileSync(identityPath,'utf8'));
    const identities=await command('containers.list');
    a=identities.find(x=>x.name==='ESR test A');
    b=identities.find(x=>x.name==='ESR test B');
    assert.ok(a&&b,'Named containers must survive restart; do not recreate them');
    assert.deepEqual([a.cookieStoreId,b.cookieStoreId],expected,'Container identities must remain unchanged');
    console.log('PASS: same named container identities after restart');
    const tabs=await command('tabs.create',{container:a.name,url:fixture});
    const tabsB=await command('tabs.create',{container:b.name,url:fixture});
    assert.match(await read(a.name,tabs.tabId,'Local storage: A'),/Cookie session: A/);
    assert.match(await read(b.name,tabsB.tabId,'Local storage: B'),/Cookie session: B/);
    console.log('PASS: persistent isolation after restart');
    return;
  }
  a=await command('containers.ensure',{container:'ESR test A'});
  b=await command('containers.ensure',{container:'ESR test B'});
  assert.notEqual(a.cookieStoreId,b.cookieStoreId);
  fs.writeFileSync(identityPath,JSON.stringify([a.cookieStoreId,b.cookieStoreId]));
  const ta=await command('tabs.create',{container:a.name,url:fixture+'?slot=A'});
  const tb=await command('tabs.create',{container:b.name,url:fixture+'?slot=B'});
  await read(a.name,ta.tabId,'Local storage: A');
  await read(b.name,tb.tabId,'Local storage: B');
  for(const [container,tabId,slot] of [[a.name,ta.tabId,'A'],[b.name,tb.tabId,'B']]){
    await command('tabs.navigate',{container,tabId,url:fixture});
    assert.match(await read(container,tabId,'Local storage: '+slot),new RegExp('Cookie session: '+slot));
  }
  console.log('PASS: independent cookies and localStorage');
  await command('tabs.type',{container:a.name,tabId:ta.tabId,selector:'#composer',text:'ESR synthetic test',clear:true});
  await command('tabs.click',{container:a.name,tabId:ta.tabId,selector:'#send'});
  await read(a.name,ta.tabId,'Sent placeholder: ESR synthetic test');
  console.log('PASS: type click and readback');
  await command('tabs.key',{container:a.name,tabId:ta.tabId,key:'Escape'});
  await read(a.name,ta.tabId,'Key event: Escape');
  for(const [cmd,fields] of [['tabs.approve',{service:'GitHub'}],['tabs.setEffort',{effort:'High'}]]) {
    const r=await request('/commands',{cmd,container:a.name,tabId:ta.tabId,...fields});
    assert.equal(r.body.error?.code,'URL_FORBIDDEN');
  }
  console.log('PASS: synthetic key event and ChatGPT-only guard through real ESR');
  const wrong=await request('/commands',{cmd:'tabs.readText',container:b.name,tabId:ta.tabId});
  assert.equal(wrong.body.error?.code,'CONTAINER_MISMATCH');
  console.log('PASS: wrong-context rejection');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
