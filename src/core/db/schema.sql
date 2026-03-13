-- GT-DAYN — مخطط قاعدة البيانات الموحد
-- النسخة: 1.0.0
-- يعمل على: sql.js (Web) | better-sqlite3 (Electron) | @capacitor/sqlite (Android)

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ─── جدول الإعدادات ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- القيم الافتراضية
INSERT OR IGNORE INTO settings VALUES ('currency',     'SAR');
INSERT OR IGNORE INTO settings VALUES ('currency_sym', 'ر.س');
INSERT OR IGNORE INTO settings VALUES ('lang',         'ar');
INSERT OR IGNORE INTO settings VALUES ('theme',        'light');
INSERT OR IGNORE INTO settings VALUES ('db_version',   '1');

-- ─── جدول الأشخاص ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS persons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  avatar     TEXT,                     -- لون hex أو إيموجي
  phone      TEXT,
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── جدول الديون ─────────────────────────────────────────────────────────────
-- type: 'receivable' = لي عند | 'payable' = عليّ
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

-- ─── جدول الدفعات ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id    INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount     REAL    NOT NULL CHECK(amount > 0),
  note       TEXT,
  paid_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── جدول الدفعات المجدولة ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id     INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount      REAL    NOT NULL,
  due_date    TEXT    NOT NULL,          -- YYYY-MM-DD
  freq_type   TEXT    NOT NULL CHECK(freq_type IN ('daily','weekly','monthly')),
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','postponed')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── جدول الميزانية الشهرية ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_months (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  month      TEXT    NOT NULL UNIQUE,   -- YYYY-MM
  income     REAL    NOT NULL DEFAULT 0,
  spent      REAL    NOT NULL DEFAULT 0,  -- إجمالي المصاريف المسجلة
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── جدول فئات الميزانية ─────────────────────────────────────────────────────
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

-- ─── جدول مصاريف الميزانية ───────────────────────────────────────────────────
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

-- ─── جدول مزامنة Drive ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drive_sync (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id      TEXT,                    -- Google Drive file ID
  last_synced  TEXT,
  status       TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','syncing','done','error')),
  error_msg    TEXT
);

INSERT OR IGNORE INTO drive_sync (id) VALUES (1);

-- ─── الفهارس ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_debts_person    ON debts(person_id);
CREATE INDEX IF NOT EXISTS idx_debts_status    ON debts(status);
CREATE INDEX IF NOT EXISTS idx_payments_debt   ON payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_sched_debt      ON scheduled_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_sched_due       ON scheduled_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_expenses_cat    ON budget_expenses(category_id);

-- ─── مشغل تحديث updated_at تلقائياً ──────────────────────────────────────────
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

-- ─── مشغل تحديث remaining تلقائياً عند إضافة دفعة ───────────────────────────
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
