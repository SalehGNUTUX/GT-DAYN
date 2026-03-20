/**
 * GT-DAYN — ElectronAdapter.js
 * يحوّل IPC calls من الـ Renderer إلى DbAdapter موحّد
 * يستخدم window.__ELECTRON__.db المُعرَّف في preload.js
 */

import { DbAdapter } from './DbAdapter.js';

export class ElectronAdapter extends DbAdapter {
  async init() { return this; }

  async query(sql, params = []) {
    return window.__ELECTRON__.db.query(sql, params);
  }

  async run(sql, params = []) {
    return window.__ELECTRON__.db.run(sql, params);
  }

  async export() {
    const buf = await window.__ELECTRON__.db.export();
    return new Uint8Array(buf);
  }

  async import(data) {
    return window.__ELECTRON__.db.import(Array.from(data));
  }

  async close() {}
}
