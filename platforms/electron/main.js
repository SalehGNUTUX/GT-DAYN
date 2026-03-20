/**
 * GT-DAYN — Electron main.js  v1.0.0
 * قاعدة البيانات: sql.js عبر Node.js (لا native modules — يعمل على كل المنصات)
 * التخزين: ملف .sqlite في userData
 */

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── مسارات ──────────────────────────────────────────────────────────────────
const IS_DEV   = process.env.NODE_ENV === 'development';
const APP_ROOT = path.join(__dirname, '../../');
const DB_PATH  = path.join(app.getPath('userData'), 'gt-dayn.sqlite');
const SCHEMA   = path.join(APP_ROOT, 'src/core/db/schema.sql');
const SQLJS_PATH = path.join(APP_ROOT, 'node_modules/sql.js/dist/sql-wasm.js');
const WASM_PATH  = path.join(APP_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

let SQL = null;   // sql.js module
let db  = null;   // SQL.Database instance
let win = null;

// ── تهيئة sql.js ──────────────────────────────────────────────────────────────
async function initDB() {
  // تحميل sql.js من node_modules محلياً (بدون CDN)
  const initSqlJs = require(SQLJS_PATH);
  SQL = await initSqlJs({
    locateFile: () => WASM_PATH,
  });

  // تحميل قاعدة بيانات موجودة أو إنشاء جديدة
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  // تشغيل schema
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  db.run(schema);

  // حفظ دوري كل 10 ثوانٍ
  setInterval(persistDB, 10000);

  console.log('[DB] Initialized:', DB_PATH);
}

function persistDB() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.warn('[DB] persist error:', e.message);
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('db:query', (_, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch (e) { throw new Error(`[DB] Query: ${e.message} | SQL: ${sql}`); }
});

ipcMain.handle('db:run', (_, sql, params = []) => {
  try {
    db.run(sql, params);
    const meta = db.exec('SELECT last_insert_rowid() as id, changes() as ch');
    const row  = meta[0]?.values[0] ?? [0, 0];
    return { lastInsertRowid: row[0], changes: row[1] };
  } catch (e) { throw new Error(`[DB] Run: ${e.message} | SQL: ${sql}`); }
});

ipcMain.handle('db:export', () => {
  persistDB();
  return fs.readFileSync(DB_PATH);
});

ipcMain.handle('db:import', (_, data) => {
  db.close();
  const buf = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buf);
  db = new SQL.Database(buf);
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  return true;
});

ipcMain.handle('dialog:saveFile', async (_, { defaultName, data, filters }) => {
  const { filePath } = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters });
  if (filePath) { fs.writeFileSync(filePath, Buffer.from(data)); return filePath; }
  return null;
});

ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:getPath',    (_, n) => app.getPath(n));
ipcMain.on('shell:openExternal', (_, url) => {
  if (url.startsWith('https://')) shell.openExternal(url);
});

// ── النافذة ─────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 430, height: 860,
    minWidth: 360, minHeight: 580,
    title: 'GT-DAYN',
    icon:  path.join(APP_ROOT, 'public/icons/icon.png'),
    backgroundColor: '#1e1b4b',
    show: false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      // COOP/COEP لـ WASM threading
      additionalArguments: [],
    },
  });

  // Headers لـ sql.js WASM
  win.webContents.session.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy':   ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    });
  });

  if (IS_DEV) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(APP_ROOT, 'index.html'));
  }

  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.on('closed', () => { win = null; });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', () => persistDB());
}

// ── دورة حياة التطبيق ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  await initDB();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  persistDB();
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => { persistDB(); try { db?.close(); } catch {} });
