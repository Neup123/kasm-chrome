'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const key=fs.readFileSync('/run/secrets/driver_api_key','utf8').trim();
const root='http://gateway:8081';
const base=root+'/agent-driver/v1';
async function req(path, body, authorized=true){
  const headers={'Content-Type':'application/json'};
  if(authorized)headers['X-API-Key']=key;
  const r=await fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(65000)});
  return {status:r.status,body:await r.json()};
}
async function cmd(command,fields={}){
  const r=await req('/commands',{cmd:command,...fields});
  if(!r.body.ok)throw new Error(command+': '+(r.body.error?.code||'failed'));
  return r.body.result;
}
async function main(){
  let ready=false;
  for(let i=0;i<120;i++){
    try{
      const r=await req('/status');
      if(r.body.result?.bridge?.state==='ready'&&r.body.result.bridge.extensionVersion==='0.1.3'){ready=true;break;}
    }catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
  assert.ok(ready,'Signed 0.1.3 bridge not ready');
  assert.equal((await req('/status',null,false)).status,401);
  assert.equal((await fetch(root+'/',{redirect:'manual'})).status,401);
  console.log('PASS: gateway browser and driver reject unauthenticated access; authenticated 0.1.3 bridge ready');
  const container='Kasm Release Acceptance';
  const identity=await cmd('containers.ensure',{container});
  const tabs=await cmd('tabs.list',{container});
  const fixture=process.env.ACCEPTANCE_CI_FIXTURE==='1';
  const url=fixture?'http://driver:8080/fixtures/session':'https://chatgpt.com/';
  if(tabs.length===0){
    const tab=await cmd('tabs.create',{container,url});
    console.log('PASS: created fresh acceptance tab',JSON.stringify({container,tabId:tab.tabId,cookieStoreId:identity.cookieStoreId,fixture}));
  }else{
    // Never navigate or act on a previously authenticated or running tab.
    console.log('Acceptance container already has tabs; no existing tab touched');
  }
}
main().catch(e=>{console.error('Acceptance bootstrap failed: '+e.message);process.exitCode=1;});
