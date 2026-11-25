'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const { EXTENSION_ID, WS_URL, isValidSecret } = require('../extension/protocol.js');

function secretEquals(candidate, expected) {
  if (typeof candidate !== 'string') return false;
  const digest = value => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(digest(candidate), digest(expected));
}

function validateConfig({ apiKey, wsToken, ...other }) {
  if (!isValidSecret(apiKey) || !isValidSecret(wsToken) || secretEquals(apiKey, wsToken)) {
    throw new Error('Invalid driver secret configuration; distinct random base64url secrets are required.');
  }
  return { ...other, apiKey, wsToken };
}

function loadConfig(env = process.env) {
  try {
    const apiKey = fs.readFileSync(env.DRIVER_API_KEY_FILE || '/run/secrets/driver_api_key', 'utf8').trim();
    const managed = JSON.parse(fs.readFileSync(
      env.DRIVER_MANAGED_STORAGE_FILE || '/run/secrets/driver_managed_storage', 'utf8'));
    if (managed.name !== EXTENSION_ID || managed.type !== 'storage' ||
        managed.data?.wsUrl !== WS_URL || typeof managed.description !== 'string') {
      throw new Error('Invalid managed configuration');
    }
    return validateConfig({ apiKey, wsToken: managed.data.wsToken });
  } catch {
    // Do not include file contents, file paths, parser excerpts or secret values.
    throw new Error('Driver secret configuration could not be loaded or validated.');
  }
}

module.exports = { EXTENSION_ID, WS_URL, loadConfig, validateConfig, secretEquals };
