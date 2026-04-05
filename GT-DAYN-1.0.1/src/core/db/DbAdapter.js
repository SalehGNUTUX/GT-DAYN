/**
 * GT-DAYN — DbAdapter.js
 * واجهة مجردة موحدة لقاعدة البيانات
 * كل منصة تُنفّذ هذه الواجهة بمحرّكها الخاص
 */

export class DbAdapter {
  /** تهيئة الاتصال وتشغيل schema.sql */
  async init() { throw new Error('Not implemented'); }

  /**
   * تنفيذ استعلام يُعيد صفوفاً
   * @param {string} sql
   * @param {Array}  params
   * @returns {Promise<Array<Object>>}
   */
  async query(sql, params = []) { throw new Error('Not implemented'); }

  /**
   * تنفيذ استعلام تعديل (INSERT / UPDATE / DELETE)
   * @param {string} sql
   * @param {Array}  params
   * @returns {Promise<{ lastInsertRowid: number, changes: number }>}
   */
  async run(sql, params = []) { throw new Error('Not implemented'); }

  /**
   * تصدير قاعدة البيانات كـ Uint8Array (للنسخ الاحتياطي و Drive)
   * @returns {Promise<Uint8Array>}
   */
  async export() { throw new Error('Not implemented'); }

  /**
   * استيراد قاعدة بيانات من Uint8Array
   * @param {Uint8Array} data
   */
  async import(data) { throw new Error('Not implemented'); }

  /** إغلاق الاتصال */
  async close() { throw new Error('Not implemented'); }
}
