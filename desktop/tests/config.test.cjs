const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig, validateBaseUrl } = require('../config.cjs');
const source = require('../../mobile/appfanclubs.config.json');
test('desktop and Expo use the same connection config', () => {
  const mobile = require('../../mobile/app.config.js')({ config: { extra: { eas: { projectId: 'test' } } } });
  assert.equal(loadConfig().apiBaseUrl, source.apiBaseUrl);
  assert.equal(mobile.extra.apiUrl, source.apiBaseUrl);
  assert.equal(mobile.extra.eas.projectId, 'test');
});
test('portable sidecar overrides bundled config without a rebuild', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fanclubs-config-'));
  try {
    fs.writeFileSync(path.join(folder, 'appfanclubs.config.json'), JSON.stringify({ apiBaseUrl: 'https://example.test:8443/' }));
    assert.equal(loadConfig({ packaged: true, portableDirectory: folder }).apiBaseUrl, 'https://example.test:8443/');
    assert.equal(loadConfig({ packaged: false, portableDirectory: folder }).apiBaseUrl, source.apiBaseUrl);
  } finally { fs.rmSync(folder, { recursive: true }); }
});
test('reject unsafe or ambiguous endpoint configuration', () => {
  for (const value of ['http://example.test', 'https://user:pass@example.test', 'https://example.test/bad%20path', 'https://example.test?q=1', 'file:///tmp', 'https://example.test/#x', undefined]) assert.throws(() => validateBaseUrl(value));
  assert.equal(validateBaseUrl('http://127.0.0.1:5173'), 'http://127.0.0.1:5173/');
});
test('invalid sidecar fails explicitly instead of silently using another server', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fanclubs-config-'));
  try {
    fs.writeFileSync(path.join(folder, 'appfanclubs.config.json'), '{invalid');
    assert.throws(() => loadConfig({ packaged: true, portableDirectory: folder }));
  } finally { fs.rmSync(folder, { recursive: true }); }
});

test('service prefix is preserved and canonicalized',()=>{assert.equal(validateBaseUrl('https://chillapi.stream/appfanclubs'),'https://chillapi.stream/appfanclubs/');});
