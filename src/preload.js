const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bgs', {
  call: async (action, args) => { const r = await ipcRenderer.invoke('rpc', action, args); if (!r.ok) throw new Error(r.error); return r.data; },
  on: cb => ipcRenderer.on('evt', (_, k) => cb(k)),
  saveFile: (name, data) => ipcRenderer.invoke('file.save', name, data),
  openFile: () => ipcRenderer.invoke('file.open'),
  platform: process.platform,
});
