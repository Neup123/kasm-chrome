#!/usr/bin/env node
'use strict';
// Recover an already-submitted unlisted version through Mozilla's version API.
// All credentials live in GitHub Actions secrets, never in source or output.
const fs = require('node:fs');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const issuer = process.env.AMO_JWT_ISSUER, secret = process.env.AMO_JWT_SECRET;
if (!issuer || !secret) throw Error('AMO signing credentials unavailable');
const fail = message => {console.error('AMO recovery: '+message); process.exit(1);};
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
function jwt() {
 const now=Math.floor(Date.now()/1000);
 const body=b64({iss:issuer,jti:crypto.randomUUID(),iat:now,exp:now+60});
 const h=b64({alg:'HS256',typ:'JWT'});
 return h+'.'+body+'.'+crypto.createHmac('sha256',secret).update(h+'.'+body).digest('base64url');
}
async function main(){
 const manifest=JSON.parse(fs.readFileSync('extension/manifest.json','utf8'));
 const id=manifest.browser_specific_settings.gecko.id, version=manifest.version;
 const endpoint='https://addons.mozilla.org/api/v5/addons/addon/'+encodeURIComponent(id)+'/versions/v'+encodeURIComponent(version)+'/';
 const resp=await fetch(endpoint,{headers:{Authorization:'JWT '+jwt(),Accept:'application/json'},redirect:'error'});
 if(!resp.ok) fail('version lookup HTTP '+resp.status+' (AMO authorization or submitted version unavailable)');
 const record=await resp.json();
 if(record.version!==version || record.channel!=='unlisted') fail('AMO version/channel mismatch');
 if(!record.file?.url) fail('AMO version has no downloadable file yet; file status: '+String(record.file?.status||'unknown'));
 let location=record.file.url, bytes=null;
 for(let redirects=0;redirects<4;redirects++){
  const target=new URL(location);
  if(target.protocol!=='https:' || !['addons.mozilla.org','addons.cdn.mozilla.net'].includes(target.hostname)) fail('untrusted AMO file redirect host');
  const response=await fetch(target,{headers:target.hostname==='addons.mozilla.org'?{Authorization:'JWT '+jwt()}: {},redirect:'manual'});
  if([301,302,303,307,308].includes(response.status)){location=new URL(response.headers.get('location'),target).toString();continue;}
  if(!response.ok) fail('AMO file download HTTP '+response.status);
  const data=Buffer.from(await response.arrayBuffer());
  if(data.length===0||data.length>10*1024*1024) fail('unexpected signed XPI size');
  bytes=data;break;
 }
 if(!bytes) fail('AMO file redirects exceeded bound');
 const digest=crypto.createHash('sha256').update(bytes).digest('hex');
 const remoteHash=record.file.hash||'';
 if(remoteHash && remoteHash.toLowerCase().startsWith('sha256:') && remoteHash.slice(7).toLowerCase()!==digest) fail('AMO remote SHA-256 mismatch');
 fs.mkdirSync('artifacts',{recursive:true});
 fs.writeFileSync('artifacts/kasm-agent-signed.xpi',bytes);
 const metadata={extension_id:id,version,channel:'unlisted',sha256:digest,source_verified:false,signed_at:new Date().toISOString(),cryptographic_acceptance:'Requires Firefox Release policy-install evidence'};
 fs.writeFileSync('artifacts/signed-artifact.json',JSON.stringify(metadata,null,2)+'\n');
 const verify=spawnSync('python3',['scripts/verify-xpi.py','artifacts/kasm-agent-signed.xpi','--require-signature','--metadata','artifacts/signed-artifact.json'],{encoding:'utf8'});
 if(verify.status!==0){
   const reason=(verify.stderr||'').match(/^Artifact verification failed: ([^\r\n]{1,240})/m);
   fail('source/identity verification failed: '+(reason?reason[1]:'unknown local failure'));
 }
 metadata.source_verified=true;
 fs.writeFileSync('artifacts/signed-artifact.json',JSON.stringify(metadata,null,2)+'\n');
 console.log(JSON.stringify({signed_xpi:'artifacts/kasm-agent-signed.xpi',sha256:digest,extension_id:id,version,channel:'unlisted',source_verified:true,signature_structure_verified:true,firefox_trust_verified:false}));
}
main().catch(e=>fail('request failed: '+(e.code||e.message||'unknown').slice(0,180)));
