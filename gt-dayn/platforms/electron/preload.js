/**
 * GT-DAYN — preload.js
 * جسر آمن بين الـ Renderer والـ Main عبر contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__ELECTRON__', true);

contextBridge.exposeInMainWorld('electronDB', {
  query:      (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  run:        (sql, params) => ipcRenderer.invoke('db:run',   sql, params),
  export:     ()            => ipcRenderer.invoke('db:export'),
  import:     (data)        => ipcRenderer.invoke('db:import', data),
  saveFile:   (opts)        => ipcRenderer.invoke('dialog:saveFile', opts),
});
