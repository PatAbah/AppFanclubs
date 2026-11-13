const { app, BrowserWindow, ipcMain, shell, session, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { loadConfig } = require('./config.cjs');
const { discoverApps, selectedApps, retainSelectionIds } = require('./inventory.cjs');
let win, base, scanning;
function inventory() {
  if (!scanning) scanning = discoverApps().finally(() => { scanning = null; });
  return scanning;
}
function emit(data) { if (win && !win.isDestroyed()) win.webContents.send('fanclubs-native', data); }
function trusted(url) { try { return new URL(url).origin === new URL(base).origin && new URL(url).pathname.startsWith(new URL(base).pathname); } catch { return false; } }
app.whenReady().then(() => {
  try { base = loadConfig({ packaged: app.isPackaged, portableDirectory: process.env.PORTABLE_EXECUTABLE_DIR || (process.platform === 'darwin' ? path.resolve(path.dirname(app.getPath('exe')), '../../..') : path.dirname(app.getPath('exe'))) }).apiBaseUrl; }
  catch (error) { dialog.showErrorBox('AppFanclubs configuration', error.message); app.quit(); return; }
  win = new BrowserWindow({ width: 1180, height: 820, minWidth: 390, minHeight: 600, title: 'AppFanclubs', backgroundColor: '#edf0f4', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (trusted(url) && new URL(url).pathname.startsWith(new URL('api/files/', base).pathname)) win.webContents.downloadURL(url);
    else if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) { event.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.loadURL(base);
  ipcMain.on('fanclubs-command', async (event, { type, ...data }) => {
    if (event.sender !== win.webContents || !trusted(event.senderFrame.url)) return;
    try {
      if (type === 'inventory') {
        let result = await inventory();
        try {
          const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'selection.json'), 'utf8'));
          if (Array.isArray(saved)) result = retainSelectionIds(result, saved);
        } catch {}
        emit({ type: 'inventory', platform: process.platform === 'darwin' ? 'macos' : 'windows', ...result });
        if (!result.complete) emit({ type: 'error', message: 'Some app sources were unavailable. This list may be incomplete.' });
      }
      if (type === 'saveSelection' && Array.isArray(data.packages) && data.packages.every(id => typeof id === 'string')) fs.writeFileSync(path.join(app.getPath('userData'), 'selection.json'), JSON.stringify(data.packages));
      if (type === 'notifications') emit({ type: 'error', message: 'Push delivery is currently supported on Android. Desktop updates appear while the app is open.' });
    } catch (error) { emit({ type: 'error', message: error.message }); }
  });
  let last = 0;
  win.on('focus', async () => {
    if (Date.now() - last < 60000) return; last = Date.now();
    try {
      const selected = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'selection.json'), 'utf8'));
      if (!Array.isArray(selected)) return;
      const result = await inventory();
      if (!result.complete) return; 
      const chosen = selectedApps(result, selected);
      emit({ type: 'inventoryRefresh', platform: 'windows', selected: chosen.map(app => app.package), apps: chosen });
    } catch {  }
  });
});
app.on('window-all-closed', () => app.quit());
