const fs = require('node:fs');
const path = require('node:path');
function validateBaseUrl(value) {
  if (typeof value !== 'string') throw new Error('apiBaseUrl is required in appfanclubs.config.json');
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(url.pathname)) {
    throw new Error('apiBaseUrl must be an HTTPS base URL without credentials, query or fragment.');
  }
  return url.origin + url.pathname.replace(/\/?$/, '/');
}
function loadConfig({ portableDirectory, packaged = false } = {}) {
  const bundledPath = path.join(__dirname, '..', 'mobile', 'appfanclubs.config.json');
  const overridePath = packaged && portableDirectory ? path.join(portableDirectory, 'appfanclubs.config.json') : null;
  const source = overridePath && fs.existsSync(overridePath) ? overridePath : bundledPath;
  const config = JSON.parse(fs.readFileSync(source, 'utf8'));
  return { apiBaseUrl: validateBaseUrl(config.apiBaseUrl), source };
}
module.exports = { loadConfig, validateBaseUrl };
