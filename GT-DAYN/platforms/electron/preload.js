/**
 * GT-DAYN — preload.js
 * يُوفّر جسر آمن بين عملية Renderer وعملية Main
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__ELECTRON__', {
  // ── قاعدة البيانات ──
  db: {
    query:  (sql, params) => ipcRenderer.invoke('db:query',  sql, params),
    run:    (sql, params) => ipcRenderer.invoke('db:run',    sql, params),
    export: ()            => ipcRenderer.invoke('db:export'),
    import: (data)        => ipcRenderer.invoke('db:import', data),
  },

  // ── نظام الملفات (حوارات الحفظ) ──
  dialog: {
    saveFile: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
  },

  // ── معلومات التطبيق ──
  app: {
    getVersion: ()     => ipcRenderer.invoke('app:getVersion'),
    getPath:    (name) => ipcRenderer.invoke('app:getPath', name),
  },

  // ── فتح روابط خارجية ──
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),

  // ── إشارة أننا في Electron ──
  isElectron: true,
});
