const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
function discoverApps() {
  if (process.platform === 'darwin') return require('./discover-macos.cjs').discoverMacApps();
  if (process.platform !== 'win32') return Promise.reject(new Error('Installed-app discovery is currently supported on Windows, macOS and Android.'));
  const script = fs.readFileSync(path.join(__dirname, 'discover-windows.ps1'), 'utf8');
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 90000, encoding: 'utf8' }, (error, stdout) => {
      if (error) return reject(new Error('Windows app discovery failed. Please retry; your saved selection was kept.'));
      try {
        const result = JSON.parse(stdout.trim().replace(/^\uFEFF/, ''));
        if (!Array.isArray(result.apps)) throw new Error('Invalid inventory');
        resolve({ ...result, apps: result.apps.filter(app => app && typeof app.name === 'string' && typeof app.package === 'string') });
      } catch { reject(new Error('Windows returned an unreadable app list. Your saved selection was kept.')); }
    });
  });
}
function selectedApps(inventory, selected) {
  const wanted = new Set(selected);
  return retainSelectionIds(inventory, selected).apps.filter(app => wanted.has(app.package));
}
function retainSelectionIds(inventory, selected) {
  const wanted = new Set(selected);
  return { ...inventory, apps: inventory.apps.map(app => {
    if (wanted.has(app.package)) return app;
    const legacy = (app.aliases || []).find(id => wanted.has(id));
    return legacy ? { ...app, package: legacy, aliases: [...new Set([app.package, ...(app.aliases || [])])].filter(id => id !== legacy) } : app;
  }) };
}
module.exports = { discoverApps, selectedApps, retainSelectionIds };
