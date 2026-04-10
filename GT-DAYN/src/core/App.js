/**
 * GT-DAYN — App.js
 * نقطة الدخول المشتركة — تكتشف المنصة وتُهيئ الخدمات
 */

import { DebtService        } from './services/DebtService.js';
import { BudgetService      } from './services/BudgetService.js';
import { DriveService       } from './services/DriveService.js';
import { NotificationService} from './services/NotificationService.js';
import { migrateFromLegacy  } from './db/migrate.js';

async function resolveAdapter() {
  if (window.__ELECTRON__) {
    const { ElectronAdapter } = await import('./db/ElectronAdapter.js');
    return new ElectronAdapter();
  }
  if (window.Capacitor?.isNativePlatform?.()) {
    const { CapacitorAdapter } = await import('./db/CapacitorAdapter.js');
    return new CapacitorAdapter();
  }
  const { WebSQLiteAdapter } = await import('./db/WebSQLiteAdapter.js');
  return new WebSQLiteAdapter();
}

export class App {
  constructor() {
    this.db            = null;
    this.debts         = null;
    this.budget        = null;
    this.drive         = null;
    this.notifications = null;
  }

  async init() {
    this.db = await (await resolveAdapter()).init();

    const migration = await migrateFromLegacy(this.db);
    if (migration.migrated) {
      console.info(`GT-DAYN: رُحِّل ${migration.count} دين من النسخة القديمة`);
    }

    this.debts         = new DebtService(this.db);
    this.budget        = new BudgetService(this.db);
    this.drive         = new DriveService(this.db);
    this.notifications = new NotificationService(this.db);

    this.notifications.scheduleDailyCheck(this.debts).catch(() => {});

    window.dispatchEvent(new CustomEvent('gt-dayn:ready', { detail: this }));
    return this;
  }

  async exportJSON() {
    const [persons, debts, payments, scheduled, budget, categories, expenses] =
      await Promise.all([
        this.db.query('SELECT * FROM persons'),
        this.db.query('SELECT * FROM debts'),
        this.db.query('SELECT * FROM payments'),
        this.db.query('SELECT * FROM scheduled_payments'),
        this.db.query('SELECT * FROM budget_months'),
        this.db.query('SELECT * FROM budget_categories'),
        this.db.query('SELECT * FROM budget_expenses'),
      ]);
    return JSON.stringify({ version:'1.0.0', exportedAt:new Date().toISOString(),
      persons, debts, payments, scheduled, budget, categories, expenses }, null, 2);
  }
}

export const app = new App();
