import { D as DbAdapter } from "./DbAdapter-BfKqjr-p.js";
const IS_ELECTRON = typeof window !== "undefined" && !!window.__ELECTRON__;
const SQL_JS_CDN = IS_ELECTRON ? null : "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js";
const WASM_URL = IS_ELECTRON ? null : "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm";
const DB_NAME = "gt_dayn_v1";
class WebSQLiteAdapter extends DbAdapter {
  constructor() {
    super();
    this._db = null;
    this._SQL = null;
    this._dirty = false;
    this._saving = false;
  }
  async init() {
    if (!window.initSqlJs) {
      await this._loadScript(SQL_JS_CDN);
    }
    this._SQL = await window.initSqlJs({ locateFile: () => WASM_URL });
    const saved = await this._load();
    this._db = saved ? new this._SQL.Database(saved) : new this._SQL.Database();
    const schema = await fetch("./src/core/db/schema.sql").then((r) => r.text()).catch(() => fetch("/src/core/db/schema.sql").then((r) => r.text()));
    this._db.run(schema);
    this._migrate();
    setInterval(() => {
      if (this._dirty && !this._saving) this._persist();
    }, 5e3);
    return this;
  }
  async query(sql, params = []) {
    const stmt = this._db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
  async run(sql, params = []) {
    var _a;
    this._db.run(sql, params);
    this._dirty = true;
    const meta = this._db.exec("SELECT last_insert_rowid() as id, changes() as ch");
    const row = ((_a = meta[0]) == null ? void 0 : _a.values[0]) ?? [0, 0];
    return { lastInsertRowid: row[0], changes: row[1] };
  }
  async export() {
    return this._db.export();
  }
  async import(data) {
    this._db.close();
    this._db = new this._SQL.Database(data);
    this._dirty = true;
    await this._persist();
  }
  async close() {
    if (this._dirty) await this._persist();
    this._db.close();
  }
  // ── التخزين الداخلي ─────────────────────────────────────────────────────────
  async _persist() {
    this._saving = true;
    try {
      const data = this._db.export();
      if (this._opfsSupported()) {
        await this._saveOPFS(data);
      } else {
        await this._saveIDB(data);
      }
      this._dirty = false;
    } finally {
      this._saving = false;
    }
  }
  async _load() {
    if (this._opfsSupported()) return this._loadOPFS();
    return this._loadIDB();
  }
  _opfsSupported() {
    return "storage" in navigator && "getDirectory" in navigator.storage;
  }
  async _saveOPFS(data) {
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(`${DB_NAME}.sqlite`, { create: true });
    const writer = await fh.createWritable();
    await writer.write(data);
    await writer.close();
  }
  async _loadOPFS() {
    try {
      const root = await navigator.storage.getDirectory();
      const fh = await root.getFileHandle(`${DB_NAME}.sqlite`);
      const file = await fh.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return null;
    }
  }
  async _saveIDB(data) {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore("db");
      req.onsuccess = (e) => {
        const tx = e.target.result.transaction("db", "readwrite");
        const store = tx.objectStore("db");
        store.put(data, "data");
        tx.oncomplete = res;
        tx.onerror = rej;
      };
    });
  }
  async _loadIDB() {
    return new Promise((res) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore("db");
      req.onsuccess = (e) => {
        const tx = e.target.result.transaction("db", "readonly");
        const store = tx.objectStore("db");
        const get = store.get("data");
        get.onsuccess = () => res(get.result ?? null);
        get.onerror = () => res(null);
      };
      req.onerror = () => res(null);
    });
  }
  // ── ترقية تلقائية للإصدارات القديمة ────────────────────────────────────────
  _migrate() {
    const alterIfMissing = (table, col, definition) => {
      try {
        this._db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
        console.log(`✅ Migration: added ${table}.${col}`);
      } catch (e) {
      }
    };
    alterIfMissing("budget_categories", "icon", "TEXT DEFAULT '💰'");
    alterIfMissing("budget_categories", "due_day", "INTEGER");
    alterIfMissing("budget_expenses", "month_id", "INTEGER");
    alterIfMissing("budget_months", "spent", "REAL DEFAULT 0");
  }
  _loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
}
export {
  WebSQLiteAdapter
};
