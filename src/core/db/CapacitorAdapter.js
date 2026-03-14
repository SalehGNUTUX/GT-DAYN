/**
 * GT-DAYN — CapacitorAdapter.js
 * SQLite native على Android/iOS عبر @capacitor-community/sqlite
 */

import { DbAdapter } from './DbAdapter.js';

export class CapacitorAdapter extends DbAdapter {
  constructor() {
    super();
    this._db   = null;
    this._conn = null;
  }

  async init() {
    const { CapacitorSQLite, SQLiteConnection } = await import(
      '@capacitor-community/sqlite'
    );

    this._conn = new SQLiteConnection(CapacitorSQLite);

    // فتح أو إنشاء قاعدة البيانات (مشفّرة: false في البداية)
    this._db = await this._conn.createConnection(
      'gt_dayn', false, 'no-encryption', 1, false
    );
    await this._db.open();

    // تشغيل schema
    const schema = await fetch('./schema.sql').then(r => r.text());
    await this._db.execute(schema);

    return this;
  }

  async query(sql, params = []) {
    const result = await this._db.query(sql, params);
    return result.values ?? [];
  }

  async run(sql, params = []) {
    const result = await this._db.run(sql, params, false);
    return {
      lastInsertRowid: result.changes?.lastId    ?? 0,
      changes:         result.changes?.changes   ?? 0,
    };
  }

  async export() {
    // تصدير كـ base64 ثم تحويل
    const exp  = await this._conn.exportToJson('full');
    const json = JSON.stringify(exp.export);
    return new TextEncoder().encode(json);
  }

  async import(data) {
    const json = new TextDecoder().decode(data);
    await this._conn.importFromJson(json);
  }

  async close() {
    await this._db.close();
    await this._conn.closeConnection('gt_dayn', false);
  }
}
