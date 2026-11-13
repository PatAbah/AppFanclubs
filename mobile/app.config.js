const connection = require('./appfanclubs.config.json');
module.exports = ({ config }) => {
  const base = new URL(connection.apiBaseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(base.pathname)) {
    throw new Error('appfanclubs.config.json apiBaseUrl must be an HTTPS base URL without credentials, query or fragment.');
  }
  return { ...config, extra: { ...config.extra, apiUrl: base.origin + base.pathname.replace(/\/?$/, '/') } };
};
