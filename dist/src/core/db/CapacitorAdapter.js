/**
 * GT-DAYN — CapacitorAdapter.js  v3
 * Android/iOS: sql.js single-thread (بدون SharedArrayBuffer)
 * يُحمّل sql.js من الملفات المحلية داخل الـ APK
 * البيانات: localStorage (مدمج في WebView — لا مشاكل أذونات)
 */

import { DbAdapter } from './DbAdapter.js';

const DB_KEY = 'gt-dayn-db-v1';

export class CapacitorAdapter extends DbAdapter {
  constructor() { super(); this._db = null; this._SQL = null; this._dirty = false; }

  async init() {
    await this._loadSqlJs();
    const saved = this._loadFromStorage();
    this._db = saved ? new this._SQL.Database(saved) : new this._SQL.Database();
    this._db.run('PRAGMA foreign_keys=ON');
    this._db.run(SCHEMA_SQL);
    this._migrate();
    setInterval(() => { if (this._dirty) this._persist(); }, 3000);
    window.addEventListener('beforeunload', () => this._persist());
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
    this._db.run(sql, params);
    this._dirty = true;
    const meta = this._db.exec('SELECT last_insert_rowid() as id, changes() as ch');
    const row  = meta[0]?.values[0] ?? [0, 0];
    return { lastInsertRowid: row[0], changes: row[1] };
  }

  async export()       { return this._db.export(); }
  async import(data)   { this._db.close(); this._db = new this._SQL.Database(data); this._dirty = true; this._persist(); }
  async close()        { this._persist(); this._db.close(); }

  _loadSqlJs() {
    return new Promise((resolve, reject) => {
      if (window.initSqlJs) return this._initSQL().then(resolve, reject);
      const s = document.createElement('script');
      // محاولة تحميل من مجلد محلي أولاً، ثم CDN كـ fallback
      const localPath = './sql-wasm.js';
      const cdnPath   = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js';
      s.src     = localPath;
      s.onload  = () => this._initSQL().then(resolve, reject);
      s.onerror = () => {
        const s2   = document.createElement('script');
        s2.src     = cdnPath;
        s2.onload  = () => this._initSQL().then(resolve, reject);
        s2.onerror = () => reject(new Error('Failed to load sql.js'));
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    });
  }

  async _initSQL() {
    // بدون locateFile → يبحث عن sql-wasm.wasm في نفس مجلد sql-wasm.js
    this._SQL = await window.initSqlJs();
  }

  _persist() {
    try {
      const data   = this._db.export();
      const b64    = btoa(String.fromCharCode.apply(null, data));
      localStorage.setItem(DB_KEY, b64);
      this._dirty  = false;
    } catch (e) { console.warn('[DB persist]', e); }
  }

  _loadFromStorage() {
    try {
      const b64 = localStorage.getItem(DB_KEY);
      if (!b64) return null;
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    } catch { return null; }
  }

  _migrate() {
    const add = (t, c, d) => { try { this._db.run(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`); } catch {} };
    add('budget_categories', 'icon',     "TEXT DEFAULT '💰'");
    add('budget_categories', 'due_day',  'INTEGER');
    add('budget_expenses',   'month_id', 'INTEGER');
    add('budget_months',     'spent',    'REAL DEFAULT 0');
    add('debt_edits',        'id',       'INTEGER');
    // إنشاء جدول debt_edits إن لم يكن موجوداً
    try {
      this._db.run(`CREATE TABLE IF NOT EXISTS debt_edits (
        id INTEGER PRIMARY KEY AUTOINCREMENT, debt_id INTEGER NOT NULL,
        field TEXT NOT NULL, old_value TEXT NOT NULL, new_value TEXT NOT NULL,
        edited_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
    } catch {}
  }
}

const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings VALUES ('currency',     'SAR');
INSERT OR IGNORE INTO settings VALUES ('currency_sym', 'ر.س');
INSERT OR IGNORE INTO settings VALUES ('lang',         'ar');
INSERT OR IGNORE INTO settings VALUES ('theme',        'light');
INSERT OR IGNORE INTO settings VALUES ('db_version',   '1');

CREATE TABLE IF NOT EXISTS persons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  avatar     TEXT,                     -- لون hex أو إيموجي
  phone      TEXT,
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id   INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL CHECK(type IN ('receivable','payable')),
  title       TEXT    NOT NULL,          -- وصف الدين
  amount      REAL    NOT NULL CHECK(amount > 0),
  remaining   REAL    NOT NULL,
  note        TEXT,
  status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','done','archived')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id    INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount     REAL    NOT NULL CHECK(amount > 0),
  note       TEXT,
  paid_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id     INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount      REAL    NOT NULL,
  due_date    TEXT    NOT NULL,          -- YYYY-MM-DD
  freq_type   TEXT    NOT NULL CHECK(freq_type IN ('daily','weekly','monthly')),
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','postponed')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budget_months (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  month      TEXT    NOT NULL UNIQUE,   -- YYYY-MM
  income     REAL    NOT NULL DEFAULT 0,
  spent      REAL    NOT NULL DEFAULT 0,  -- إجمالي المصاريف المسجلة
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budget_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id    INTEGER NOT NULL REFERENCES budget_months(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  icon        TEXT    DEFAULT '💰',
  color       TEXT,
  budget_cap  REAL    NOT NULL DEFAULT 0,
  due_day     INTEGER CHECK(due_day BETWEEN 1 AND 31),  -- يوم الاستحقاق الشهري
  sort_order  INTEGER NOT NULL DEFAULT 0,
  linked_type TEXT    CHECK(linked_type IN ('debt_payments', NULL))
);

CREATE TABLE IF NOT EXISTS budget_expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  month_id     INTEGER REFERENCES budget_months(id),
  amount       REAL    NOT NULL CHECK(amount > 0),
  note         TEXT,
  expense_date TEXT    NOT NULL DEFAULT (date('now')),
  payment_id   INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drive_sync (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id      TEXT,                    -- Google Drive file ID
  last_synced  TEXT,
  status       TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','syncing','done','error')),
  error_msg    TEXT
);

INSERT OR IGNORE INTO drive_sync (id) VALUES (1);

CREATE INDEX IF NOT EXISTS idx_debts_person    ON debts(person_id);
CREATE INDEX IF NOT EXISTS idx_debts_status    ON debts(status);
CREATE INDEX IF NOT EXISTS idx_payments_debt   ON payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_sched_debt      ON scheduled_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_sched_due       ON scheduled_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_expenses_cat    ON budget_expenses(category_id);

CREATE TRIGGER IF NOT EXISTS trg_debts_updated
  AFTER UPDATE ON debts
  FOR EACH ROW BEGIN
    UPDATE debts SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_persons_updated
  AFTER UPDATE ON persons
  FOR EACH ROW BEGIN
    UPDATE persons SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_recalc_remaining
  AFTER INSERT ON payments
  FOR EACH ROW BEGIN
    UPDATE debts
      SET remaining = amount - (
        SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.debt_id = NEW.debt_id
      ),
      status = CASE
        WHEN amount - (
          SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.debt_id = NEW.debt_id
        ) <= 0 THEN 'done'
        ELSE 'active'
      END
    WHERE id = NEW.debt_id;
  END;

CREATE TABLE IF NOT EXISTS debt_edits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id      INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  field        TEXT    NOT NULL,          -- 'amount' | 'type' | 'title'
  old_value    TEXT    NOT NULL,
  new_value    TEXT    NOT NULL,
  edited_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_debt_edits ON debt_edits(debt_id);
`;
