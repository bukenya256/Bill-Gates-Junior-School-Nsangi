const { app, BrowserWindow, ipcMain, safeStorage, Menu, dialog } = require('electron');
const path = require('path'), fs = require('fs');
const { createApp } = require('./core/app');
if (!app.requestSingleInstanceLock()) { app.quit(); }
let win, core;
const enc = { enc: s => (safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(s).toString('base64') : 'raw:' + Buffer.from(s).toString('base64')), dec: s => (s.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(s.slice(4), 'base64')) : Buffer.from(s.slice(4), 'base64').toString()) };
function page() { const m = core.A.mode; return path.join(__dirname, m === 'hm' ? 'hm/index.html' : m === 'teacher' ? 'teacher/index.html' : 'mode.html'); }
function create() {
  win = new BrowserWindow({ width: 1366, height: 820, minWidth: 1000, minHeight: 640, title: 'Bill Gates Junior School', backgroundColor: '#f3f6fb', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  win.loadFile(page());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const docs = app.getPath('documents');
  core = createApp({ dataDir: path.join(app.getPath('userData'), 'data'), backupDir: path.join(docs, 'BGS-Backups'), enc, notify: k => { if (win && !win.isDestroyed()) win.webContents.send('evt', k); } });
  // Excel files for the Teachers' PC: save a downloaded sheet / pick a filled sheet to upload.
  ipcMain.handle('file.save', async (_, name, b64) => {
    try {
      const r = await dialog.showSaveDialog(win, { title: 'Save Excel file', defaultPath: path.join(docs, path.basename(String(name || 'BGS.xlsx'))), filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }] });
      if (r.canceled || !r.filePath) return { ok: false, cancelled: true };
      fs.writeFileSync(r.filePath, Buffer.from(String(b64 || ''), 'base64')); return { ok: true, path: r.filePath };
    } catch (e) { return { ok: false, error: /EBUSY|EPERM|EACCES/.test(e.code || '') ? 'The file could not be saved. If it is open in Excel, close it and try again.' : 'The file could not be saved: ' + e.message }; }
  });
  ipcMain.handle('file.open', async () => {
    try {
      const r = await dialog.showOpenDialog(win, { title: 'Choose the filled marks sheet (Excel)', defaultPath: docs, filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }], properties: ['openFile'] });
      if (r.canceled || !r.filePaths[0]) return { ok: false, cancelled: true };
      const st = fs.statSync(r.filePaths[0]); if (st.size > 10 * 1024 * 1024) return { ok: false, error: 'The file is too large (limit 10 MB).' };
      return { ok: true, name: path.basename(r.filePaths[0]), data: fs.readFileSync(r.filePaths[0]).toString('base64') };
    } catch (e) { return { ok: false, error: 'The file could not be opened: ' + e.message }; }
  });
  ipcMain.handle('rpc', async (_, action, args) => {
    if (action === 'mode.set' || action === 'app.reset') {
      const r = await core.call(action, args);
      if (r.ok) { if (action === 'app.reset') core.shutdown(), core.A.mode = null; setTimeout(() => { if (action === 'app.reset') { app.relaunch(); app.exit(0); } else win.loadFile(page()); }, 100); }
      return r;
    }
    if (action === 'backup.restore') {
      const f = dialog.showOpenDialogSync(win, { title: 'Choose a backup file', defaultPath: path.join(docs, 'BGS-Backups'), filters: [{ name: 'BGS backup', extensions: ['json'] }], properties: ['openFile'] });
      if (!f) return { ok: false, error: 'Cancelled' };
      try { JSON.parse(fs.readFileSync(f[0], 'utf8')); } catch (e) { return { ok: false, error: 'That file is not a valid backup.' }; }
      const sure = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Cancel', 'Replace all data'], defaultId: 0, cancelId: 0, message: 'Replace ALL current records with this backup?', detail: 'The current data is saved first as a safety copy.' });
      if (sure !== 1) return { ok: false, error: 'Cancelled' };
      core.backupNow(false); core.shutdown(); fs.copyFileSync(f[0], path.join(app.getPath('userData'), 'data', 'hm-data.json')); app.relaunch(); app.exit(0); return { ok: true, data: true };
    }
    return core.call(action, args);
  });
  create();
});
app.on('before-quit', () => core && core.shutdown());
app.on('window-all-closed', () => app.quit());
