/**
 * GT-DAYN — ElectronAdapter.js
 * يحوّل IPC calls من الـ Renderer إلى DbAdapter موحّد
 */

import { DbAdapter } from './DbAdapter.js';

export class ElectronAdapter extends DbAdapter {
  async init()                { return this; }

  async query(sql, params = []) {
    return window.electronDB.query(sql, params);
  }

  async run(sql, params = []) {
    return window.electronDB.run(sql, params);
  }

  async export() {
    const buf = await window.electronDB.export();
    return new Uint8Array(buf);
  }

  async import(data) {
    return window.electronDB.import(Array.from(data));
  }

  async close() {}  // الـ main process يتولى الإغلاق
}
