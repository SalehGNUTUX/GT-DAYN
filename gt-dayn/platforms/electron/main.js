/**
 * GT-DAYN — Electron main.js
 * العملية الرئيسية لنسخة سطح المكتب
 * قاعدة البيانات: better-sqlite3 (أسرع من sql.js للـ native)
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(app.getPath('userData'), 'gt-dayn.sqlite');
let   db      = null;
let   win     = null;

// ── قاعدة البيانات ─────────────────────────────────────────────────────────

function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // تشغيل schema.sql
  const schema = fs.readFileSync(path.join(__dirname, '../../src/core/db/schema.sql'), 'utf8');
  db.exec(schema);
}

// ── IPC — الواجهة الخلفية للـ UI ────────────────────────────────────────────

ipcMain.handle('db:query', (_, sql, params = []) => {
  try {
    return db.prepare(sql).all(params);
  } catch (e) {
    throw new Error(e.message);
  }
});

ipcMain.handle('db:run', (_, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const info = stmt.run(params);
    return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
  } catch (e) {
    throw new Error(e.message);
  }
});

ipcMain.handle('db:export', () => {
  // إرجاع محتوى الملف كـ Buffer
  return fs.readFileSync(DB_PATH);
});

ipcMain.handle('db:import', (_, data) => {
  db.close();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return true;
});

ipcMain.handle('dialog:saveFile', async (_, { defaultName, data, filters }) => {
  const { filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters,
  });
  if (filePath) {
    fs.writeFileSync(filePath, Buffer.from(data));
    return filePath;
  }
  return null;
});

// ── النافذة الرئيسية ────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width:          420,
    height:         820,
    minWidth:       380,
    minHeight:      600,
    title:          'GT-DAYN',
    icon:           path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initDB();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => { db?.close(); });
