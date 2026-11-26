/* Shared, dependency-free protocol. Loaded by Firefox and required by Node. */
(function (root, factory) {
  const protocol = factory();
  if (typeof module === 'object' && module.exports) module.exports = protocol;
  else root.KasmProtocol = protocol;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PROTOCOL_VERSION = 1;
  const EXTENSION_ID = 'kasm-agent@chabad.gr';
  const WS_URL = 'ws://driver:8080/ws';
  const isValidSecret = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43,256}$/.test(value);
  const LIMITS = Object.freeze({
    maxTextLength: 64000, maxSelectorLength: 2000, maxMessageBytes: 524288,
    maxQueue: 32, maxReadTextLength: 120000, maxTimeoutMs: 60000,
    maxContainerLength: 64, maxIdLength: 100
  });
  const COMMANDS = Object.freeze([
    'containers.ensure', 'containers.list', 'tabs.create', 'tabs.navigate',
    'tabs.close', 'tabs.list', 'tabs.readText', 'tabs.eval', 'tabs.click', 'tabs.type',
    'tabs.setEffort', 'tabs.approve', 'tabs.key'
  ]);
  const COLORS = Object.freeze(['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'toolbar']);
  const ICONS = Object.freeze(['fingerprint', 'briefcase', 'dollar', 'cart', 'circle', 'gift', 'vacation', 'food']);
  const PROBES = Object.freeze(['page', 'elements', 'storage']);
  const EFFORTS = Object.freeze(['Low', 'Medium', 'High']);
  const KEY_PATTERN = '^(?:(?:Ctrl|Alt|Shift|Meta)\\+)*(?:Escape|Enter|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Tab|Backspace|Delete|Home|End|PageUp|PageDown|[A-Z0-9]) = ['id', 'cmd', 'container', 'deadline', 'timeoutMs'];
  const FIELDS = Object.freeze({
    'containers.ensure': ['color', 'icon'], 'containers.list': [],
    'tabs.create': ['url', 'active'], 'tabs.navigate': ['tabId', 'url'],
    'tabs.close': ['tabId'], 'tabs.list': [],
    'tabs.readText': ['tabId', 'selector', 'maxLength'],
    'tabs.eval': ['tabId', 'probe', 'selector'],
    'tabs.click': ['tabId', 'selector'],
    'tabs.type': ['tabId', 'selector', 'text', 'clear'],
    'tabs.setEffort': ['tabId', 'effort'], 'tabs.approve': ['tabId', 'service'],
    'tabs.key': ['tabId', 'key']
  });

  class ProtocolError extends Error {
    constructor(code, message) { super(message); this.name = 'ProtocolError'; this.code = code; }
  }
  function fail(code, message) { throw new ProtocolError(code, message); }
  function string(value, field, maximum, empty) {
    if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim())) {
      fail('INVALID_COMMAND', field + ' must be a bounded string.');
    }
    return value;
  }
  function isAllowedUrl(value) {
    try {
      const url = new URL(value);
      if (url.username || url.password) return false;
      return (url.protocol === 'https:' && url.hostname === 'chatgpt.com' && !url.port)
        || (url.protocol === 'http:' && url.hostname === 'driver' && url.port === '8080');
    } catch (_) { return false; }
  }
  function validateCommand(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_COMMAND', 'Command must be an object.');
    if (!COMMANDS.includes(input.cmd)) fail('UNKNOWN_COMMAND', 'Command is not supported.');
    if (input.cmd === 'tabs.eval' && ['code', 'script', 'expression', 'expr'].some(key => Object.prototype.hasOwnProperty.call(input, key))) {
      fail('REMOTE_CODE_FORBIDDEN', 'Only packaged read-only probes are supported.');
    }
    const allowed = COMMON_FIELDS.concat(FIELDS[input.cmd]);
    if (Object.keys(input).some(key => !allowed.includes(key))) fail('INVALID_COMMAND', 'Unexpected command field.');
    string(input.id, 'id', LIMITS.maxIdLength, false);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(input.id)) fail('INVALID_COMMAND', 'id contains unsupported characters.');
    const result = { id: input.id, cmd: input.cmd };
    if (input.cmd !== 'containers.list') {
      string(input.container, 'container', LIMITS.maxContainerLength, false);
      if (input.container.trim() !== input.container || /[\u0000-\u001f\u007f]/.test(input.container)) fail('INVALID_COMMAND', 'Container name is invalid.');
      result.container = input.container;
    } else if (input.container !== undefined) fail('INVALID_COMMAND', 'containers.list does not take a container.');
    if (input.deadline !== undefined) {
      if (!Number.isSafeInteger(input.deadline) || input.deadline < 0) fail('INVALID_COMMAND', 'deadline must be epoch milliseconds.');
      result.deadline = input.deadline;
    }
    if (input.timeoutMs !== undefined) {
      if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 100 || input.timeoutMs > LIMITS.maxTimeoutMs) fail('INVALID_COMMAND', 'timeoutMs is outside the supported range.');
      result.timeoutMs = input.timeoutMs;
    }
    if (FIELDS[input.cmd].includes('tabId')) {
      if (!Number.isSafeInteger(input.tabId) || input.tabId < 0) fail('INVALID_COMMAND', 'tabId must be a non-negative integer.');
      result.tabId = input.tabId;
    }
    if (FIELDS[input.cmd].includes('url')) {
      if (typeof input.url !== 'string' || input.url.length > 8192 || !isAllowedUrl(input.url)) fail('URL_NOT_ALLOWED', 'URL must use an allowed origin.');
      result.url = new URL(input.url).href;
    }
    for (const key of ['color', 'icon']) {
      if (input[key] !== undefined) {
        if (!(key === 'color' ? COLORS : ICONS).includes(input[key])) fail('INVALID_COMMAND', 'Invalid container ' + key + '.');
        result[key] = input[key];
      }
    }
    for (const key of ['active', 'clear']) {
      if (input[key] !== undefined) {
        if (typeof input[key] !== 'boolean') fail('INVALID_COMMAND', key + ' must be boolean.');
        result[key] = input[key];
      }
    }
    if (input.selector !== undefined) result.selector = string(input.selector, 'selector', LIMITS.maxSelectorLength, false);
    if (['tabs.click', 'tabs.type'].includes(input.cmd) || (input.cmd === 'tabs.eval' && input.probe === 'elements')) {
      if (!result.selector) fail('INVALID_COMMAND', 'selector is required.');
    }
    if (input.cmd === 'tabs.type') result.text = string(input.text, 'text', LIMITS.maxTextLength, true);
    if (input.maxLength !== undefined) {
      if (!Number.isInteger(input.maxLength) || input.maxLength < 1 || input.maxLength > LIMITS.maxReadTextLength) fail('INVALID_COMMAND', 'maxLength is outside the supported range.');
      result.maxLength = input.maxLength;
    }
    if (input.cmd === 'tabs.eval') {
      if (!PROBES.includes(input.probe)) fail('INVALID_COMMAND', 'probe must be page, elements, or storage.');
      result.probe = input.probe;
    }
    if (input.cmd === 'tabs.setEffort') {
      if (!EFFORTS.includes(input.effort)) fail('INVALID_COMMAND', 'effort must be Low, Medium, or High.');
      result.effort = input.effort;
    }
    if (input.cmd === 'tabs.approve' && input.service !== undefined) {
      if (typeof input.service !== 'string' || !new RegExp(SERVICE_PATTERN).test(input.service) || input.service.trim() !== input.service)
        fail('INVALID_COMMAND', 'service must be the exact bounded service name.');
      result.service = input.service;
    }
    if (input.cmd === 'tabs.key') {
      if (typeof input.key !== 'string' || input.key.length > 64 || !new RegExp(KEY_PATTERN).test(input.key))
        fail('INVALID_COMMAND', 'Unsupported key or shortcut.');
      const parts = input.key.split('+');
      const modifiers = parts.slice(0, -1);
      if (new Set(modifiers).size !== modifiers.length || (/^[A-Z0-9]$/.test(parts.at(-1)) && !modifiers.length))
        fail('INVALID_COMMAND', 'Use a named key or a modified letter/digit without repeated modifiers.');
      result.key = input.key;
    }
    return result;
  }
  return Object.freeze({ PROTOCOL_VERSION, EXTENSION_ID, WS_URL, isValidSecret, LIMITS, COMMANDS, FIELDS, COLORS, ICONS, PROBES, EFFORTS, KEY_PATTERN, SERVICE_PATTERN, ProtocolError, validateCommand, isAllowedUrl });
});
;
  const SERVICE_PATTERN = '^[A-Za-z0-9][A-Za-z0-9 ._&-]{0,79} = ['id', 'cmd', 'container', 'deadline', 'timeoutMs'];
  const FIELDS = Object.freeze({
    'containers.ensure': ['color', 'icon'], 'containers.list': [],
    'tabs.create': ['url', 'active'], 'tabs.navigate': ['tabId', 'url'],
    'tabs.close': ['tabId'], 'tabs.list': [],
    'tabs.readText': ['tabId', 'selector', 'maxLength'],
    'tabs.eval': ['tabId', 'probe', 'selector'],
    'tabs.click': ['tabId', 'selector'],
    'tabs.type': ['tabId', 'selector', 'text', 'clear']
  });

  class ProtocolError extends Error {
    constructor(code, message) { super(message); this.name = 'ProtocolError'; this.code = code; }
  }
  function fail(code, message) { throw new ProtocolError(code, message); }
  function string(value, field, maximum, empty) {
    if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim())) {
      fail('INVALID_COMMAND', field + ' must be a bounded string.');
    }
    return value;
  }
  function isAllowedUrl(value) {
    try {
      const url = new URL(value);
      if (url.username || url.password) return false;
      return (url.protocol === 'https:' && url.hostname === 'chatgpt.com' && !url.port)
        || (url.protocol === 'http:' && url.hostname === 'driver' && url.port === '8080');
    } catch (_) { return false; }
  }
  function validateCommand(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_COMMAND', 'Command must be an object.');
    if (!COMMANDS.includes(input.cmd)) fail('UNKNOWN_COMMAND', 'Command is not supported.');
    if (input.cmd === 'tabs.eval' && ['code', 'script', 'expression', 'expr'].some(key => Object.prototype.hasOwnProperty.call(input, key))) {
      fail('REMOTE_CODE_FORBIDDEN', 'Only packaged read-only probes are supported.');
    }
    const allowed = COMMON_FIELDS.concat(FIELDS[input.cmd]);
    if (Object.keys(input).some(key => !allowed.includes(key))) fail('INVALID_COMMAND', 'Unexpected command field.');
    string(input.id, 'id', LIMITS.maxIdLength, false);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(input.id)) fail('INVALID_COMMAND', 'id contains unsupported characters.');
    const result = { id: input.id, cmd: input.cmd };
    if (input.cmd !== 'containers.list') {
      string(input.container, 'container', LIMITS.maxContainerLength, false);
      if (input.container.trim() !== input.container || /[\u0000-\u001f\u007f]/.test(input.container)) fail('INVALID_COMMAND', 'Container name is invalid.');
      result.container = input.container;
    } else if (input.container !== undefined) fail('INVALID_COMMAND', 'containers.list does not take a container.');
    if (input.deadline !== undefined) {
      if (!Number.isSafeInteger(input.deadline) || input.deadline < 0) fail('INVALID_COMMAND', 'deadline must be epoch milliseconds.');
      result.deadline = input.deadline;
    }
    if (input.timeoutMs !== undefined) {
      if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 100 || input.timeoutMs > LIMITS.maxTimeoutMs) fail('INVALID_COMMAND', 'timeoutMs is outside the supported range.');
      result.timeoutMs = input.timeoutMs;
    }
    if (FIELDS[input.cmd].includes('tabId')) {
      if (!Number.isSafeInteger(input.tabId) || input.tabId < 0) fail('INVALID_COMMAND', 'tabId must be a non-negative integer.');
      result.tabId = input.tabId;
    }
    if (FIELDS[input.cmd].includes('url')) {
      if (typeof input.url !== 'string' || input.url.length > 8192 || !isAllowedUrl(input.url)) fail('URL_NOT_ALLOWED', 'URL must use an allowed origin.');
      result.url = new URL(input.url).href;
    }
    for (const key of ['color', 'icon']) {
      if (input[key] !== undefined) {
        if (!(key === 'color' ? COLORS : ICONS).includes(input[key])) fail('INVALID_COMMAND', 'Invalid container ' + key + '.');
        result[key] = input[key];
      }
    }
    for (const key of ['active', 'clear']) {
      if (input[key] !== undefined) {
        if (typeof input[key] !== 'boolean') fail('INVALID_COMMAND', key + ' must be boolean.');
        result[key] = input[key];
      }
    }
    if (input.selector !== undefined) result.selector = string(input.selector, 'selector', LIMITS.maxSelectorLength, false);
    if (['tabs.click', 'tabs.type'].includes(input.cmd) || (input.cmd === 'tabs.eval' && input.probe === 'elements')) {
      if (!result.selector) fail('INVALID_COMMAND', 'selector is required.');
    }
    if (input.cmd === 'tabs.type') result.text = string(input.text, 'text', LIMITS.maxTextLength, true);
    if (input.maxLength !== undefined) {
      if (!Number.isInteger(input.maxLength) || input.maxLength < 1 || input.maxLength > LIMITS.maxReadTextLength) fail('INVALID_COMMAND', 'maxLength is outside the supported range.');
      result.maxLength = input.maxLength;
    }
    if (input.cmd === 'tabs.eval') {
      if (!PROBES.includes(input.probe)) fail('INVALID_COMMAND', 'probe must be page, elements, or storage.');
      result.probe = input.probe;
    }
    return result;
  }
  return Object.freeze({ PROTOCOL_VERSION, EXTENSION_ID, WS_URL, isValidSecret, LIMITS, COMMANDS, FIELDS, COLORS, ICONS, PROBES, ProtocolError, validateCommand, isAllowedUrl });
});
;
  const COMMON_FIELDS = ['id', 'cmd', 'container', 'deadline', 'timeoutMs'];
  const FIELDS = Object.freeze({
    'containers.ensure': ['color', 'icon'], 'containers.list': [],
    'tabs.create': ['url', 'active'], 'tabs.navigate': ['tabId', 'url'],
    'tabs.close': ['tabId'], 'tabs.list': [],
    'tabs.readText': ['tabId', 'selector', 'maxLength'],
    'tabs.eval': ['tabId', 'probe', 'selector'],
    'tabs.click': ['tabId', 'selector'],
    'tabs.type': ['tabId', 'selector', 'text', 'clear']
  });

  class ProtocolError extends Error {
    constructor(code, message) { super(message); this.name = 'ProtocolError'; this.code = code; }
  }
  function fail(code, message) { throw new ProtocolError(code, message); }
  function string(value, field, maximum, empty) {
    if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim())) {
      fail('INVALID_COMMAND', field + ' must be a bounded string.');
    }
    return value;
  }
  function isAllowedUrl(value) {
    try {
      const url = new URL(value);
      if (url.username || url.password) return false;
      return (url.protocol === 'https:' && url.hostname === 'chatgpt.com' && !url.port)
        || (url.protocol === 'http:' && url.hostname === 'driver' && url.port === '8080');
    } catch (_) { return false; }
  }
  function validateCommand(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_COMMAND', 'Command must be an object.');
    if (!COMMANDS.includes(input.cmd)) fail('UNKNOWN_COMMAND', 'Command is not supported.');
    if (input.cmd === 'tabs.eval' && ['code', 'script', 'expression', 'expr'].some(key => Object.prototype.hasOwnProperty.call(input, key))) {
      fail('REMOTE_CODE_FORBIDDEN', 'Only packaged read-only probes are supported.');
    }
    const allowed = COMMON_FIELDS.concat(FIELDS[input.cmd]);
    if (Object.keys(input).some(key => !allowed.includes(key))) fail('INVALID_COMMAND', 'Unexpected command field.');
    string(input.id, 'id', LIMITS.maxIdLength, false);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(input.id)) fail('INVALID_COMMAND', 'id contains unsupported characters.');
    const result = { id: input.id, cmd: input.cmd };
    if (input.cmd !== 'containers.list') {
      string(input.container, 'container', LIMITS.maxContainerLength, false);
      if (input.container.trim() !== input.container || /[\u0000-\u001f\u007f]/.test(input.container)) fail('INVALID_COMMAND', 'Container name is invalid.');
      result.container = input.container;
    } else if (input.container !== undefined) fail('INVALID_COMMAND', 'containers.list does not take a container.');
    if (input.deadline !== undefined) {
      if (!Number.isSafeInteger(input.deadline) || input.deadline < 0) fail('INVALID_COMMAND', 'deadline must be epoch milliseconds.');
      result.deadline = input.deadline;
    }
    if (input.timeoutMs !== undefined) {
      if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 100 || input.timeoutMs > LIMITS.maxTimeoutMs) fail('INVALID_COMMAND', 'timeoutMs is outside the supported range.');
      result.timeoutMs = input.timeoutMs;
    }
    if (FIELDS[input.cmd].includes('tabId')) {
      if (!Number.isSafeInteger(input.tabId) || input.tabId < 0) fail('INVALID_COMMAND', 'tabId must be a non-negative integer.');
      result.tabId = input.tabId;
    }
    if (FIELDS[input.cmd].includes('url')) {
      if (typeof input.url !== 'string' || input.url.length > 8192 || !isAllowedUrl(input.url)) fail('URL_NOT_ALLOWED', 'URL must use an allowed origin.');
      result.url = new URL(input.url).href;
    }
    for (const key of ['color', 'icon']) {
      if (input[key] !== undefined) {
        if (!(key === 'color' ? COLORS : ICONS).includes(input[key])) fail('INVALID_COMMAND', 'Invalid container ' + key + '.');
        result[key] = input[key];
      }
    }
    for (const key of ['active', 'clear']) {
      if (input[key] !== undefined) {
        if (typeof input[key] !== 'boolean') fail('INVALID_COMMAND', key + ' must be boolean.');
        result[key] = input[key];
      }
    }
    if (input.selector !== undefined) result.selector = string(input.selector, 'selector', LIMITS.maxSelectorLength, false);
    if (['tabs.click', 'tabs.type'].includes(input.cmd) || (input.cmd === 'tabs.eval' && input.probe === 'elements')) {
      if (!result.selector) fail('INVALID_COMMAND', 'selector is required.');
    }
    if (input.cmd === 'tabs.type') result.text = string(input.text, 'text', LIMITS.maxTextLength, true);
    if (input.maxLength !== undefined) {
      if (!Number.isInteger(input.maxLength) || input.maxLength < 1 || input.maxLength > LIMITS.maxReadTextLength) fail('INVALID_COMMAND', 'maxLength is outside the supported range.');
      result.maxLength = input.maxLength;
    }
    if (input.cmd === 'tabs.eval') {
      if (!PROBES.includes(input.probe)) fail('INVALID_COMMAND', 'probe must be page, elements, or storage.');
      result.probe = input.probe;
    }
    return result;
  }
  return Object.freeze({ PROTOCOL_VERSION, EXTENSION_ID, WS_URL, isValidSecret, LIMITS, COMMANDS, FIELDS, COLORS, ICONS, PROBES, ProtocolError, validateCommand, isAllowedUrl });
});
