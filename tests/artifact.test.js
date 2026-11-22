'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

test('artifact verifier checks source identity, unsigned rejection, tampering and metadata',()=>{
  const python=String.raw`
import importlib.util,json,pathlib,tempfile,zipfile,hashlib
spec=importlib.util.spec_from_file_location('verifier','scripts/verify-xpi.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
source=pathlib.Path('extension')
with tempfile.TemporaryDirectory() as tmp:
 p=pathlib.Path(tmp)/'test.xpi'
 def build(signature=False,tamper=False):
  with zipfile.ZipFile(p,'w') as z:
   for f in source.rglob('*'):
    if f.is_file():
     payload=f.read_bytes()
     if tamper and f.name=='protocol.js':payload+=b'\n// altered\n'
     z.writestr(f.relative_to(source).as_posix(),payload)
   if signature:
    for n in ['manifest.mf','mozilla.sf','mozilla.rsa']:z.writestr('META-INF/'+n,b'FAKE TEST STRUCTURE; NOT A TRUSTED SIGNATURE')
 build()
 assert v.verify(p,source)['signature_entries_present'] is False
 try:v.verify(p,source,True);raise AssertionError('Unsigned XPI accepted')
 except ValueError:pass
 build(True)
 r=v.verify(p,source,True)
 assert r['cryptographic_trust_verified'] is False
 m=pathlib.Path(tmp)/'metadata.json'
 m.write_text(json.dumps(dict(r,channel='unlisted')))
 v.verify(p,source,True,m)
 build(True,True)
 try:v.verify(p,source,True);raise AssertionError('Source tampering accepted')
 except ValueError:pass
 build(True)
 d=json.loads(m.read_text());d['sha256']='0'*64;m.write_text(json.dumps(d))
 try:v.verify(p,source,True,m);raise AssertionError('Hash mismatch accepted')
 except ValueError:pass
print('Artifact gates passed; fake signature structure never claims cryptographic trust.')
`;
  const r=spawnSync('python3',['-c',python],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
});

test('signing refuses to run without secure credentials and never requests plaintext input',()=>{
  const env={...process.env};delete env.AMO_JWT_ISSUER;delete env.AMO_JWT_SECRET;
  const r=spawnSync(process.execPath,['scripts/sign-extension.js'],{cwd:path.resolve(__dirname,'..'),env,encoding:'utf8'});
  assert.equal(r.status,1);
  assert.match(r.stderr,/Signing blocked/);
  assert.match(r.stderr,/Do not paste credentials/);
});
