#!/usr/bin/env node
'use strict';
// Credentials enter through a secret-injected environment, never CLI arguments.
// Subprocess output is deliberately not forwarded; it may contain remote data.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

function stop(message) { console.error(message); process.exit(1); }
const root = path.resolve(__dirname, '..');
process.chdir(root);
const issuer = process.env.AMO_JWT_ISSUER;
const secret = process.env.AMO_JWT_SECRET;
if (!issuer || !secret) stop('Signing blocked: inject AMO_JWT_ISSUER and AMO_JWT_SECRET through the approved secure channel. Do not paste credentials into chat.');
const outputDir = path.join(root, 'artifacts', 'amo');
fs.mkdirSync(outputDir, {recursive:true});
if (fs.readdirSync(outputDir).some(name => name.endsWith('.xpi'))) stop('Signing blocked: artifacts/amo already contains an XPI. Inspect it before another submission.');
const command = path.join(root, 'node_modules', 'web-ext', 'bin', 'web-ext.js');
const childEnv = {...process.env, WEB_EXT_API_KEY:issuer, WEB_EXT_API_SECRET:secret,
  WEB_EXT_VERBOSE:'false', WEB_EXT_NO_INPUT:'true', WEB_EXT_CONFIG_DISCOVERY:'false'};
delete childEnv.AMO_JWT_ISSUER;
delete childEnv.AMO_JWT_SECRET;
for (const key of Object.keys(childEnv)) {
  if (key.startsWith('WEB_EXT_') && !['WEB_EXT_API_KEY','WEB_EXT_API_SECRET','WEB_EXT_VERBOSE','WEB_EXT_NO_INPUT','WEB_EXT_CONFIG_DISCOVERY'].includes(key)) delete childEnv[key];
}
console.log('Submitting the source to AMO for unlisted signing. Review may take longer than this process waits.');
const signed = spawnSync(process.execPath, [command, 'sign', '--channel', 'unlisted',
  '--source-dir', 'extension', '--artifacts-dir', outputDir,
  '--amo-metadata', 'scripts/amo-metadata.json', '--approval-timeout', '900000',
  '--no-input', '--no-config-discovery'], {env:childEnv, encoding:'utf8', timeout:950000, maxBuffer:4*1024*1024});
delete childEnv.WEB_EXT_API_KEY;
delete childEnv.WEB_EXT_API_SECRET;
if (signed.error || signed.status !== 0) stop('AMO signing did not complete. No deployment was performed. Check the AMO developer account for validation or pending review; captured remote output was not printed.');
const files = fs.readdirSync(outputDir).filter(name => name.endsWith('.xpi'));
if (files.length !== 1) stop('Signing did not produce exactly one XPI; no artifact selected.');
const source = path.join(outputDir, files[0]);
const checked = spawnSync('python3', ['scripts/verify-xpi.py', source, '--require-signature'], {encoding:'utf8'});
if (checked.status !== 0) {
  // This local verifier has no credentials; only report its fixed-format error.
  const reason = (checked.stderr || '').match(/^Artifact verification failed: ([^\r\n]{1,240})/m);
  stop(reason ? 'Signed artifact failed verification: ' + reason[1]
    : 'Signed artifact failed source/identity/signature-structure verification.');
}
const manifest = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
const bytes = fs.readFileSync(source);
const target = path.join(root, 'artifacts', 'kasm-agent-signed.xpi');
fs.writeFileSync(target, bytes, {mode:0o644});
const metadata = {extension_id:manifest.browser_specific_settings.gecko.id,
  version:manifest.version, channel:'unlisted', sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  source_verified:true, signed_at:new Date().toISOString(),
  cryptographic_acceptance:'Requires Firefox Release policy-install evidence'};
fs.writeFileSync('artifacts/signed-artifact.json', JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({artifact:'artifacts/kasm-agent-signed.xpi', ...metadata},null,2));
