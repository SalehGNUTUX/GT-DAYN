import { D as DbAdapter } from "./DbAdapter-BfKqjr-p.js";
class ElectronAdapter extends DbAdapter {
  async init() {
    return this;
  }
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
  async close() {
  }
}
export {
  ElectronAdapter
};
