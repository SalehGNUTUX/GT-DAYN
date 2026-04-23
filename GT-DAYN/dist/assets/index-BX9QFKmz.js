const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ElectronAdapter-Box8xpdD.js","assets/DbAdapter-BfKqjr-p.js","assets/CapacitorAdapter-CaUIAYq-.js","assets/WebSQLiteAdapter-DHR0y23y.js"])))=>i.map(i=>d[i]);
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const scriptRel = "modulepreload";
const assetsURL = function(dep) {
  return "/" + dep;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (deps && deps.length > 0) {
    document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = (cspNonceMeta == null ? void 0 : cspNonceMeta.nonce) || (cspNonceMeta == null ? void 0 : cspNonceMeta.getAttribute("nonce"));
    promise = Promise.allSettled(
      deps.map((dep) => {
        dep = assetsURL(dep);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};
class DebtService {
  constructor(db) {
    this._db = db;
  }
  // ══ الأشخاص ════════════════════════════════════════════════════════════════
  async getPersons() {
    return this._db.query(`
      SELECT
        p.*,
        -- ما لي عند هذا الشخص (الديون النشطة receivable)
        COALESCE(SUM(CASE WHEN d.type='receivable' AND d.status!='archived' THEN d.remaining END), 0) AS receivable_total,
        -- ما عليّ لهذا الشخص (payable)
        COALESCE(SUM(CASE WHEN d.type='payable'    AND d.status!='archived' THEN d.remaining END), 0) AS payable_total,
        -- الرصيد الصافي (موجب = لصالحي)
        COALESCE(SUM(CASE WHEN d.type='receivable' THEN d.remaining ELSE -d.remaining END), 0) AS net_balance,
        COUNT(CASE WHEN d.status='active' THEN 1 END)                                         AS active_count
      FROM persons p
      LEFT JOIN debts d ON d.person_id = p.id
      GROUP BY p.id
      ORDER BY p.name
    `);
  }
  async getPerson(id) {
    const rows = await this._db.query(
      `SELECT * FROM persons WHERE id = ?`,
      [id]
    );
    return rows[0] ?? null;
  }
  async addPerson({ name, avatar = null, phone = null, note = null }) {
    if (phone && phone.trim()) {
      const existing = await this._db.query(
        `SELECT id, name FROM persons WHERE phone=? LIMIT 1`,
        [phone.trim()]
      );
      if (existing.length) {
        throw new Error(`رقم الهاتف مُسجَّل مسبقاً باسم: ${existing[0].name}`);
      }
    }
    const { lastInsertRowid } = await this._db.run(
      `INSERT INTO persons (name, avatar, phone, note) VALUES (?, ?, ?, ?)`,
      [name.trim(), avatar, phone ? phone.trim() : null, note]
    );
    return lastInsertRowid;
  }
  async updatePerson(id, fields) {
    if (fields.phone && fields.phone.trim()) {
      const existing = await this._db.query(
        `SELECT id, name FROM persons WHERE phone=? AND id!=? LIMIT 1`,
        [fields.phone.trim(), id]
      );
      if (existing.length) {
        throw new Error(`رقم الهاتف مُسجَّل مسبقاً باسم: ${existing[0].name}`);
      }
    }
    const cols = Object.keys(fields).map((k) => `${k}=?`).join(",");
    await this._db.run(
      `UPDATE persons SET ${cols} WHERE id=?`,
      [...Object.values(fields), id]
    );
  }
  async deletePerson(id) {
    await this._db.run(`DELETE FROM persons WHERE id=?`, [id]);
  }
  // ══ الديون ═════════════════════════════════════════════════════════════════
  async getDebts({ personId = null, type = null, status = null } = {}) {
    const conditions = ["1=1"];
    const params = [];
    if (personId) {
      conditions.push("d.person_id=?");
      params.push(personId);
    }
    if (type) {
      conditions.push("d.type=?");
      params.push(type);
    }
    if (status === null) {
      conditions.push("d.status != 'archived'");
    } else if (status) {
      conditions.push("d.status=?");
      params.push(status);
    }
    return this._db.query(`
      SELECT d.*, p.name AS person_name, p.avatar AS person_avatar
      FROM debts d
      JOIN persons p ON p.id = d.person_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY d.sort_order, d.created_at DESC
    `, params);
  }
  async getDebt(id) {
    const rows = await this._db.query(
      `SELECT d.*, p.name AS person_name FROM debts d JOIN persons p ON p.id=d.person_id WHERE d.id=?`,
      [id]
    );
    return rows[0] ?? null;
  }
  /**
   * الرصيد الذكي بين المستخدم وشخص محدد
   * يجمع كل المعاملات في الاتجاهين ويعطي صافياً واحداً
   */
  async getPersonBalance(personId) {
    const rows = await this._db.query(`
      SELECT
        SUM(CASE WHEN type='receivable' THEN remaining ELSE 0 END) AS receivable,
        SUM(CASE WHEN type='payable'    THEN remaining ELSE 0 END) AS payable,
        SUM(CASE WHEN type='receivable' THEN remaining ELSE -remaining END) AS net
      FROM debts
      WHERE person_id=? AND status != 'archived'
    `, [personId]);
    return rows[0] ?? { receivable: 0, payable: 0, net: 0 };
  }
  async addDebt({ personId, type, title, amount, note = null, currency: currency2 = null }) {
    const cur = currency2 || "MAD";
    const { lastInsertRowid } = await this._db.run(`
      INSERT INTO debts (person_id, type, title, amount, remaining, note, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [personId, type, title.trim(), amount, amount, note, cur]);
    return lastInsertRowid;
  }
  async updateDebt(id, fields) {
    const allowed = ["title", "amount", "remaining", "note", "status", "sort_order", "type", "currency"];
    const cols = Object.keys(fields).filter((k) => allowed.includes(k));
    if (!cols.length) return;
    await this._db.run(
      `UPDATE debts SET ${cols.map((c) => `${c}=?`).join(",")} WHERE id=?`,
      [...cols.map((c) => fields[c]), id]
    );
    if ("amount" in fields) {
      await this._db.run(`
        UPDATE debts
        SET remaining = amount - COALESCE(
          (SELECT SUM(amount) FROM payments WHERE debt_id=?), 0
        ),
        status = CASE
          WHEN amount <= COALESCE(
            (SELECT SUM(amount) FROM payments WHERE debt_id=?), 0
          ) THEN 'done' ELSE 'active' END
        WHERE id=?
      `, [id, id, id]);
    }
  }
  async deleteDebt(id) {
    const debt = await this.getDebt(id);
    if ((debt == null ? void 0 : debt.status) === "done") {
      await this._db.run(`UPDATE debts SET status='archived' WHERE id=?`, [id]);
    } else {
      await this._db.run(`DELETE FROM debts WHERE id=?`, [id]);
    }
  }
  // ══ الدفعات ════════════════════════════════════════════════════════════════
  async getPayments(debtId) {
    return this._db.query(
      `SELECT * FROM payments WHERE debt_id=? ORDER BY paid_at DESC`,
      [debtId]
    );
  }
  async addPayment(debtId, { amount, note = null, paidAt = null }) {
    const date = paidAt ?? (/* @__PURE__ */ new Date()).toISOString();
    const { lastInsertRowid } = await this._db.run(
      `INSERT INTO payments (debt_id, amount, note, paid_at) VALUES (?, ?, ?, ?)`,
      [debtId, amount, note, date]
    );
    return lastInsertRowid;
  }
  async updatePayment(id, { amount, note, paidAt }) {
    await this._db.run(
      `UPDATE payments SET amount=?, note=?, paid_at=? WHERE id=?`,
      [amount, note, paidAt, id]
    );
    const rows = await this._db.query(
      `SELECT debt_id FROM payments WHERE id=?`,
      [id]
    );
    if (rows[0]) await this._recalcRemaining(rows[0].debt_id);
  }
  async deletePayment(id) {
    const rows = await this._db.query(`SELECT debt_id FROM payments WHERE id=?`, [id]);
    await this._db.run(`DELETE FROM payments WHERE id=?`, [id]);
    if (rows[0]) await this._recalcRemaining(rows[0].debt_id);
  }
  async _recalcRemaining(debtId) {
    await this._db.run(`
      UPDATE debts SET
        remaining = amount - COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id=?), 0),
        status    = CASE
          WHEN amount - COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id=?), 0) <= 0
          THEN 'done' ELSE 'active' END
      WHERE id=?
    `, [debtId, debtId, debtId]);
  }
  // ══ الجدولة ════════════════════════════════════════════════════════════════
  async getScheduled(debtId) {
    return this._db.query(
      `SELECT * FROM scheduled_payments WHERE debt_id=? AND status='pending' ORDER BY due_date`,
      [debtId]
    );
  }
  async getDueToday() {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    return this._db.query(`
      SELECT sp.*, d.title AS debt_title, p.name AS person_name
      FROM scheduled_payments sp
      JOIN debts   d ON d.id = sp.debt_id
      JOIN persons p ON p.id = d.person_id
      WHERE sp.status='pending' AND sp.due_date <= ?
      ORDER BY sp.due_date
    `, [today]);
  }
  async schedulePayments(debtId, { count, startDate, freqType }) {
    const debt = await this.getDebt(debtId);
    if (!debt) throw new Error("DEBT_NOT_FOUND");
    await this._db.run(
      `DELETE FROM scheduled_payments WHERE debt_id=? AND status='pending'`,
      [debtId]
    );
    const perAmount = Math.round(debt.remaining / count * 100) / 100;
    const start = new Date(startDate);
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      if (freqType === "daily") d.setDate(d.getDate() + i);
      if (freqType === "weekly") d.setDate(d.getDate() + i * 7);
      if (freqType === "monthly") d.setMonth(d.getMonth() + i);
      await this._db.run(
        `INSERT INTO scheduled_payments (debt_id, amount, due_date, freq_type) VALUES (?, ?, ?, ?)`,
        [debtId, perAmount, d.toISOString().slice(0, 10), freqType]
      );
    }
  }
  // ══ ملخص عام ═══════════════════════════════════════════════════════════════
  async getSummary() {
    const rows = await this._db.query(`
      SELECT
        SUM(CASE WHEN type='receivable' AND status='active' THEN remaining ELSE 0 END) AS total_receivable,
        SUM(CASE WHEN type='payable'    AND status='active' THEN remaining ELSE 0 END) AS total_payable,
        COUNT(CASE WHEN status='active' THEN 1 END)                                    AS active_count,
        COUNT(CASE WHEN status='done'   THEN 1 END)                                    AS done_count
      FROM debts
    `);
    const s = rows[0] ?? {};
    return {
      totalReceivable: s.total_receivable ?? 0,
      totalPayable: s.total_payable ?? 0,
      net: (s.total_receivable ?? 0) - (s.total_payable ?? 0),
      activeCount: s.active_count ?? 0,
      doneCount: s.done_count ?? 0
    };
  }
}
class BudgetService {
  constructor(db) {
    this._db = db;
  }
  static currentMonth() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  }
  async getMonth(month = BudgetService.currentMonth()) {
    const rows = await this._db.query(`SELECT * FROM budget_months WHERE month=?`, [month]);
    return rows[0] ?? null;
  }
  async getOrCreateMonth(month = BudgetService.currentMonth(), income = 0) {
    let row = await this.getMonth(month);
    if (!row) {
      const result = await this._db.run(
        `INSERT INTO budget_months (month, income) VALUES (?, ?)`,
        [month, income]
      );
      row = { id: result.lastInsertRowid, month, income };
    }
    return row;
  }
  async setIncome(month, income) {
    const bm = await this.getOrCreateMonth(month, income);
    await this._db.run(`UPDATE budget_months SET income=? WHERE id=?`, [income, bm.id]);
  }
  // ══ الفئات ═══════════════════════════════════════════════════════════════
  async getCategories(month) {
    const bm = await this.getMonth(month);
    if (!bm) return [];
    return this._db.query(`
      SELECT
        c.*,
        COALESCE(SUM(e.amount), 0) AS spent,
        CASE WHEN c.budget_cap > 0
          THEN ROUND(COALESCE(SUM(e.amount), 0) * 100.0 / c.budget_cap, 1)
          ELSE 0 END AS usage_pct
      FROM budget_categories c
      LEFT JOIN budget_expenses e ON e.category_id = c.id
      WHERE c.month_id = ?
      GROUP BY c.id
      ORDER BY c.sort_order
    `, [bm.id]);
  }
  async addCategory(month, { name, icon = "💰", color = null, budgetCap = 0, linkedType = null, dueDay = null }) {
    var _a;
    const bm = await this.getOrCreateMonth(month);
    const last = await this._db.query(
      `SELECT MAX(sort_order) AS mx FROM budget_categories WHERE month_id=?`,
      [bm.id]
    );
    const order = (((_a = last[0]) == null ? void 0 : _a.mx) ?? -1) + 1;
    const result = await this._db.run(`
      INSERT INTO budget_categories (month_id, name, icon, color, budget_cap, linked_type, due_day, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [bm.id, name.trim(), icon, color, budgetCap, linkedType, dueDay, order]);
    return { id: result.lastInsertRowid };
  }
  async updateCategory(id, fields) {
    const allowed = ["name", "icon", "color", "budget_cap", "due_day", "sort_order", "linked_type"];
    const cols = Object.keys(fields).filter((k) => allowed.includes(k));
    if (!cols.length) return;
    await this._db.run(
      `UPDATE budget_categories SET ${cols.map((c) => `${c}=?`).join(",")} WHERE id=?`,
      [...cols.map((c) => fields[c]), id]
    );
  }
  async deleteCategory(id) {
    await this._db.run(`DELETE FROM budget_categories WHERE id=?`, [id]);
  }
  // ══ المصاريف ══════════════════════════════════════════════════════════════
  async getExpenses(categoryId) {
    return this._db.query(
      `SELECT * FROM budget_expenses WHERE category_id=? ORDER BY expense_date DESC`,
      [categoryId]
    );
  }
  async addExpense(categoryId, { amount, note = null, expenseDate = null, paymentId = null, monthId = null }) {
    const date = expenseDate ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const result = await this._db.run(`
      INSERT INTO budget_expenses (category_id, month_id, amount, note, expense_date, payment_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [categoryId, monthId, amount, note, date, paymentId]);
    return result.lastInsertRowid;
  }
  async deleteExpense(id) {
    await this._db.run(`DELETE FROM budget_expenses WHERE id=?`, [id]);
  }
  // ══ الربط الذكي مع الديون ══════════════════════════════════════════════
  async linkDebtPayment(paymentId, amount, month = BudgetService.currentMonth()) {
    const cats = await this.getCategories(month);
    const debtCat = cats.find((c) => c.linked_type === "debt_payments");
    if (!debtCat) return;
    const existing = await this._db.query(
      `SELECT id FROM budget_expenses WHERE payment_id=?`,
      [paymentId]
    );
    if (existing.length) return;
    await this.addExpense(debtCat.id, { amount, note: "سداد دين (تلقائي)", paymentId });
  }
  // ══ الملخص الشهري ══════════════════════════════════════════════════════
  async getMonthSummary(month = BudgetService.currentMonth()) {
    const bm = await this.getMonth(month);
    if (!bm) return null;
    const rows = await this._db.query(`
      SELECT COALESCE(SUM(e.amount), 0) AS total_spent,
             COUNT(DISTINCT e.category_id) AS active_categories
      FROM budget_expenses e
      JOIN budget_categories c ON c.id = e.category_id
      WHERE c.month_id = ?
    `, [bm.id]);
    const s = rows[0] ?? {};
    const totalSpent = s.total_spent ?? 0;
    return {
      month,
      income: bm.income,
      totalSpent,
      remaining: (bm.income || 0) - totalSpent,
      spentPct: bm.income > 0 ? Math.round(totalSpent * 100 / bm.income) : 0,
      activeCategories: s.active_categories ?? 0
    };
  }
  async getSuggestion(month = BudgetService.currentMonth()) {
    const summary = await this.getMonthSummary(month);
    if (!summary || summary.remaining <= 0) return null;
    const payableDebts = await this._db.query(`
      SELECT d.*, p.name AS person_name
      FROM debts d JOIN persons p ON p.id = d.person_id
      WHERE d.status='active' AND d.type='payable'
      ORDER BY (d.remaining / d.amount) ASC
      LIMIT 1
    `);
    if (payableDebts.length) {
      return {
        type: "pay_debt",
        amount: Math.min(summary.remaining, payableDebts[0].remaining),
        debt: payableDebts[0],
        remaining: summary.remaining
      };
    }
    const receivableDebts = await this._db.query(`
      SELECT d.*, p.name AS person_name
      FROM debts d JOIN persons p ON p.id = d.person_id
      WHERE d.status='active' AND d.type='receivable'
      ORDER BY d.remaining DESC
      LIMIT 1
    `);
    if (receivableDebts.length) {
      return {
        type: "collect_debt",
        amount: receivableDebts[0].remaining,
        debt: receivableDebts[0],
        remaining: summary.remaining
      };
    }
    return { type: "save", amount: summary.remaining };
  }
}
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const FILE_NAME = "gt-dayn-backup.sqlite";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
class DriveService {
  constructor(db) {
    this._db = db;
    this._token = null;
    this._fileId = null;
    this._tokenExpiry = 0;
  }
  // ── المصادقة ───────────────────────────────────────────────────────────────
  async signIn() {
    return new Promise((res, rej) => {
      if (!window.google) {
        rej(new Error("GIS not loaded"));
        return;
      }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) {
            rej(new Error(resp.error));
            return;
          }
          this._token = resp.access_token;
          this._tokenExpiry = Date.now() + (resp.expires_in - 60) * 1e3;
          res(resp);
        }
      });
      client.requestAccessToken({ prompt: "" });
    });
  }
  isSignedIn() {
    return !!this._token && Date.now() < this._tokenExpiry;
  }
  signOut() {
    if (this._token) {
      google.accounts.oauth2.revoke(this._token, () => {
      });
    }
    this._token = null;
    this._fileId = null;
  }
  // ── رفع (Upload) ────────────────────────────────────────────────────────────
  async upload() {
    await this._ensureToken();
    const data = await this._db.export();
    if (!this._fileId) this._fileId = await this._findFile();
    const metadata = JSON.stringify({
      name: FILE_NAME,
      parents: ["appDataFolder"]
    });
    const form = new FormData();
    form.append("metadata", new Blob([metadata], { type: "application/json" }));
    form.append("file", new Blob([data], { type: "application/octet-stream" }));
    const url = this._fileId ? `${UPLOAD_API}/files/${this._fileId}?uploadType=multipart` : `${UPLOAD_API}/files?uploadType=multipart`;
    const method = this._fileId ? "PATCH" : "POST";
    const resp = await this._fetch(url, { method, body: form });
    const json = await resp.json();
    this._fileId = json.id;
    await this._updateSyncRecord("done");
    return json.id;
  }
  // ── تنزيل (Download) ────────────────────────────────────────────────────────
  async download() {
    await this._ensureToken();
    if (!this._fileId) this._fileId = await this._findFile();
    if (!this._fileId) throw new Error("NO_BACKUP");
    const resp = await this._fetch(
      `${DRIVE_API}/files/${this._fileId}?alt=media`
    );
    if (!resp.ok) throw new Error("DOWNLOAD_FAILED");
    const buffer = await resp.arrayBuffer();
    await this._db.import(new Uint8Array(buffer));
    await this._updateSyncRecord("done");
  }
  // ── داخلي ───────────────────────────────────────────────────────────────────
  async _findFile() {
    var _a, _b;
    const q = encodeURIComponent(`name='${FILE_NAME}' and 'appDataFolder' in parents and trashed=false`);
    const resp = await this._fetch(`${DRIVE_API}/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
    const json = await resp.json();
    return ((_b = (_a = json.files) == null ? void 0 : _a[0]) == null ? void 0 : _b.id) ?? null;
  }
  async _ensureToken() {
    if (!this.isSignedIn()) await this.signIn();
  }
  _fetch(url, opts = {}) {
    return fetch(url, {
      ...opts,
      headers: {
        ...opts.headers ?? {},
        Authorization: `Bearer ${this._token}`
      }
    });
  }
  async _updateSyncRecord(status) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await this._db.run(
      `UPDATE drive_sync SET file_id=?, last_synced=?, status=?, error_msg=NULL WHERE id=1`,
      [this._fileId, now, status]
    );
  }
}
class NotificationService {
  constructor(db) {
    this._db = db;
  }
  /** طلب إذن الإشعارات */
  async requestPermission() {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return Notification.requestPermission();
  }
  /**
   * جدولة فحص يومي للدفعات المستحقة
   * يُشغَّل عند تحميل التطبيق
   */
  async scheduleDailyCheck(debtService) {
    const perm = await this.requestPermission();
    if (perm !== "granted") return;
    await this.checkAndNotify(debtService);
    const INTERVAL = 24 * 60 * 60 * 1e3;
    setInterval(() => this.checkAndNotify(debtService), INTERVAL);
  }
  async checkAndNotify(debtService) {
    try {
      const dues = await debtService.getDueToday();
      for (const d of dues) {
        await this._notify({
          title: `دفعة مستحقة — ${d.person_name}`,
          body: `${d.debt_title}: ${Math.round(d.amount).toLocaleString("ar-SA")} — مستحقة اليوم`,
          tag: `due-${d.id}`,
          // منع التكرار
          data: { debtId: d.debt_id, schedId: d.id }
        });
      }
    } catch {
    }
  }
  async _notify({ title, body, tag, data }) {
    if (!("serviceWorker" in navigator)) {
      new Notification(title, { body, dir: "rtl", lang: "ar", icon: "./icons/icon-192.png" });
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      dir: "rtl",
      lang: "ar",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      vibrate: [200, 100, 200],
      tag,
      data
    });
  }
  /**
   * جدولة إشعار في تاريخ محدد (عبر Push API — يحتاج سيرفر)
   * للآن: يحفظ في IndexedDB ويفحصه Service Worker
   */
  async scheduleForDate(debtId, dueDate, amount, personName) {
    await this._db.run(`
      INSERT OR IGNORE INTO scheduled_payments (debt_id, amount, due_date, freq_type)
      VALUES (?, ?, ?, 'monthly')
    `, [debtId, amount, dueDate]);
  }
}
async function migrateFromLegacy(db) {
  const flag = await db.query(`SELECT value FROM settings WHERE key='migrated_v3'`);
  if (flag.length && flag[0].value === "1") return { migrated: false, reason: "already_done" };
  const raw = localStorage.getItem("my_debts_final_v3");
  if (!raw) {
    await db.run(`INSERT OR REPLACE INTO settings VALUES ('migrated_v3','1')`);
    return { migrated: false, reason: "no_legacy_data" };
  }
  let legacyDebts;
  try {
    legacyDebts = JSON.parse(raw);
  } catch {
    return { migrated: false, reason: "parse_error" };
  }
  if (!Array.isArray(legacyDebts) || !legacyDebts.length) {
    await db.run(`INSERT OR REPLACE INTO settings VALUES ('migrated_v3','1')`);
    return { migrated: false, reason: "empty" };
  }
  let imported = 0;
  for (const old of legacyDebts) {
    const nameRaw = (old.personName ?? old.name ?? "مجهول").trim();
    let personId;
    const existing = await db.query(
      `SELECT id FROM persons WHERE name=? LIMIT 1`,
      [nameRaw]
    );
    if (existing.length) {
      personId = existing[0].id;
    } else {
      const { lastInsertRowid } = await db.run(
        `INSERT INTO persons (name) VALUES (?)`,
        [nameRaw]
      );
      personId = lastInsertRowid;
    }
    const title = (old.title ?? old.note ?? "دين منقول").trim();
    const amount = parseFloat(old.amount) || 0;
    const remaining = parseFloat(old.remaining ?? old.amount) || amount;
    const createdAt = old.date ?? old.createdAt ?? (/* @__PURE__ */ new Date()).toISOString();
    const status = remaining <= 0 ? "done" : "active";
    const { lastInsertRowid: debtId } = await db.run(`
      INSERT INTO debts (person_id, type, title, amount, remaining, note, status, created_at, updated_at)
      VALUES (?, 'receivable', ?, ?, ?, ?, ?, ?, ?)
    `, [personId, title, amount, remaining, old.note ?? null, status, createdAt, createdAt]);
    const payments = old.payments ?? old.history ?? [];
    for (const p of payments) {
      const pAmount = parseFloat(p.amount) || 0;
      if (!pAmount) continue;
      const pDate = p.date ?? p.paid_at ?? createdAt;
      await db.run(
        `INSERT INTO payments (debt_id, amount, note, paid_at) VALUES (?, ?, ?, ?)`,
        [debtId, pAmount, p.note ?? null, pDate]
      );
    }
    const schedule = old.schedule ?? old.scheduledPayments ?? [];
    for (const s of schedule) {
      const sAmount = parseFloat(s.amount) || 0;
      const sDueDate = (s.dueDate ?? s.due_date ?? "").slice(0, 10);
      const sFreq = s.frequency ?? s.freqType ?? "monthly";
      if (!sAmount || !sDueDate) continue;
      await db.run(`
        INSERT INTO scheduled_payments (debt_id, amount, due_date, freq_type, status)
        VALUES (?, ?, ?, ?, ?)
      `, [debtId, sAmount, sDueDate, sFreq, s.status ?? "pending"]);
    }
    imported++;
  }
  await db.run(`INSERT OR REPLACE INTO settings VALUES ('migrated_v3','1')`);
  try {
    localStorage.setItem("my_debts_final_v3_archive", raw);
    localStorage.removeItem("my_debts_final_v3");
  } catch {
  }
  return { migrated: true, count: imported };
}
async function resolveAdapter() {
  var _a, _b;
  if (window.__ELECTRON__) {
    const { ElectronAdapter } = await __vitePreload(async () => {
      const { ElectronAdapter: ElectronAdapter2 } = await import("./ElectronAdapter-Box8xpdD.js");
      return { ElectronAdapter: ElectronAdapter2 };
    }, true ? __vite__mapDeps([0,1]) : void 0);
    return new ElectronAdapter();
  }
  if ((_b = (_a = window.Capacitor) == null ? void 0 : _a.isNativePlatform) == null ? void 0 : _b.call(_a)) {
    const { CapacitorAdapter } = await __vitePreload(async () => {
      const { CapacitorAdapter: CapacitorAdapter2 } = await import("./CapacitorAdapter-CaUIAYq-.js");
      return { CapacitorAdapter: CapacitorAdapter2 };
    }, true ? __vite__mapDeps([2,1]) : void 0);
    return new CapacitorAdapter();
  }
  const { WebSQLiteAdapter } = await __vitePreload(async () => {
    const { WebSQLiteAdapter: WebSQLiteAdapter2 } = await import("./WebSQLiteAdapter-DHR0y23y.js");
    return { WebSQLiteAdapter: WebSQLiteAdapter2 };
  }, true ? __vite__mapDeps([3,1]) : void 0);
  return new WebSQLiteAdapter();
}
class App {
  constructor() {
    this.db = null;
    this.debts = null;
    this.budget = null;
    this.drive = null;
    this.notifications = null;
  }
  async init() {
    this.db = await (await resolveAdapter()).init();
    const migration = await migrateFromLegacy(this.db);
    if (migration.migrated) {
      console.info(`GT-DAYN: رُحِّل ${migration.count} دين من النسخة القديمة`);
    }
    this.debts = new DebtService(this.db);
    this.budget = new BudgetService(this.db);
    this.drive = new DriveService(this.db);
    this.notifications = new NotificationService(this.db);
    this.notifications.scheduleDailyCheck(this.debts).catch(() => {
    });
    window.dispatchEvent(new CustomEvent("gt-dayn:ready", { detail: this }));
    return this;
  }
  async exportJSON() {
    const [persons, debts, payments, scheduled, budget, categories, expenses] = await Promise.all([
      this.db.query("SELECT * FROM persons"),
      this.db.query("SELECT * FROM debts"),
      this.db.query("SELECT * FROM payments"),
      this.db.query("SELECT * FROM scheduled_payments"),
      this.db.query("SELECT * FROM budget_months"),
      this.db.query("SELECT * FROM budget_categories"),
      this.db.query("SELECT * FROM budget_expenses")
    ]);
    return JSON.stringify({
      version: "1.0.0",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      persons,
      debts,
      payments,
      scheduled,
      budget,
      categories,
      expenses
    }, null, 2);
  }
}
const app = new App();
function toast(msg, type = "info", duration = 2800) {
  let cont = document.getElementById("toast-container");
  if (!cont) {
    cont = document.createElement("div");
    cont.id = "toast-container";
    Object.assign(cont.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "9000",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      alignItems: "center",
      pointerEvents: "none",
      width: "max-content",
      maxWidth: "92vw"
    });
    document.body.appendChild(cont);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  cont.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-8px)";
    el.style.transition = ".2s";
    setTimeout(() => el.remove(), 220);
  }, duration);
}
function toastUndo(msg, duration = 5e3) {
  return new Promise((resolve) => {
    let cont = document.getElementById("toast-container");
    if (!cont) {
      cont = document.createElement("div");
      cont.id = "toast-container";
      const hh = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 68;
      Object.assign(cont.style, {
        position: "fixed",
        top: hh + 10 + "px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "9500",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        alignItems: "center",
        pointerEvents: "none",
        width: "max-content",
        maxWidth: "92vw"
      });
      document.body.appendChild(cont);
    }
    const el = document.createElement("div");
    el.className = "toast error";
    el.style.cssText = "pointer-events:auto;white-space:nowrap;display:flex;align-items:center;gap:10px;";
    el.innerHTML = `<span>${msg}</span><button class="toast-undo-btn" style="background:rgba(255,255,255,.2);border:1px solid currentColor;border-radius:20px;padding:3px 12px;font-family:Cairo,sans-serif;font-size:.78rem;font-weight:800;color:inherit;cursor:pointer;pointer-events:auto;">تراجع</button>`;
    cont.appendChild(el);
    let resolved = false;
    const finish = (undid) => {
      if (resolved) return;
      resolved = true;
      el.style.opacity = "0";
      el.style.transform = "translateY(-8px)";
      el.style.transition = ".2s";
      setTimeout(() => el.remove(), 220);
      resolve(undid);
    };
    el.querySelector(".toast-undo-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      finish(true);
    });
    setTimeout(() => finish(false), duration);
  });
}
function openModal(id) {
  var _a;
  (_a = document.getElementById(id)) == null ? void 0 : _a.classList.add("active");
}
function closeAllModals() {
  document.querySelectorAll(".modal-overlay.active").forEach((m) => m.classList.remove("active"));
}
function confirm(msg) {
  return new Promise((res) => {
    const ov = document.getElementById("confirm-modal-overlay");
    document.getElementById("confirm-msg").textContent = msg;
    ov.classList.add("active");
    const ok = document.getElementById("confirm-ok");
    const cxl = document.getElementById("confirm-cancel");
    const cleanup = (val) => {
      ov.classList.remove("active");
      ok.onclick = null;
      cxl.onclick = null;
      res(val);
    };
    ok.onclick = () => cleanup(true);
    cxl.onclick = () => cleanup(false);
  });
}
function fmt(n, currency2 = "", { showSymbol = true } = {}) {
  const s = Math.round(n).toLocaleString("en-US");
  if (!currency2 || !showSymbol) return s;
  return `${s} ${currency2}`;
}
function initial(name) {
  return (name ?? "").trim().charAt(0).toUpperCase();
}
const AV_COLORS = [
  ["#ede9fe", "#4338ca"],
  ["#d1fae5", "#065f46"],
  ["#fef3c7", "#92400e"],
  ["#fee2e2", "#991b1b"],
  ["#e0f2fe", "#0369a1"],
  ["#fce7f3", "#9d174d"]
];
function avatarColor(name) {
  const i = (name ?? "").charCodeAt(0) % AV_COLORS.length;
  return AV_COLORS[i];
}
function initViewportFix(selectors = [".modal-overlay"]) {
  if (!window.visualViewport) return;
  const sync = () => {
    const vh = window.visualViewport.height;
    const ratio = vh / window.screen.height;
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (ratio < 0.75) {
          el.style.height = vh + "px";
          el.style.alignItems = "center";
          el.style.paddingTop = "0";
        } else {
          el.style.height = "";
          el.style.alignItems = "flex-start";
          el.style.paddingTop = "18%";
        }
      });
    });
  };
  window.visualViewport.addEventListener("resize", sync);
  window.visualViewport.addEventListener("scroll", sync);
  sync();
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
function initDragSort(container, onReorder) {
  let src = null;
  container.querySelectorAll('[draggable="true"]').forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      src = card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging", "drag-over");
      container.querySelectorAll("[draggable]").forEach((c) => c.classList.remove("drag-over"));
      const ids = [...container.querySelectorAll("[data-id]")].map((c) => +c.dataset.id);
      onReorder(ids);
    });
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!src || card === src) return;
      card.classList.add("drag-over");
      const cards = [...container.querySelectorAll('[draggable="true"]')];
      const si = cards.indexOf(src), di = cards.indexOf(card);
      if (si < di) container.insertBefore(src, card.nextSibling);
      else container.insertBefore(src, card);
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", (e) => e.preventDefault());
  });
}
const W = 900, H = 520;
const THEMES = {
  receivable: {
    bg1: "#1e1b4b",
    bg2: "#312e81",
    accent: "#818cf8",
    accentLt: "#c7d2fe",
    label: "لي عند"
  },
  payable: {
    bg1: "#064e3b",
    bg2: "#065f46",
    accent: "#34d399",
    accentLt: "#a7f3d0",
    label: "عليّ"
  }
};
async function generateShareCard(debt, personName, currency2 = "ر.س") {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const theme = THEMES[debt.type] ?? THEMES.receivable;
  const pct = Math.min(100, Math.round((debt.amount - debt.remaining) / debt.amount * 100));
  const paid = debt.amount - debt.remaining;
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.bg1);
  grad.addColorStop(1, theme.bg2);
  ctx.fillStyle = grad;
  _roundRect(ctx, 0, 0, W, H, 32);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(W - 80, 60, 160, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 30, 160, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  await _loadFont();
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.font = "bold 22px Cairo, sans-serif";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText("GT-DAYN", W - 50, 58);
  ctx.fillStyle = "rgba(255,255,255,.3)";
  ctx.font = "16px Cairo, sans-serif";
  ctx.fillText(theme.label, W - 50, 82);
  const av = personName.trim().charAt(0);
  ctx.fillStyle = theme.accent + "33";
  _roundRect(ctx, 50, 40, 72, 72, 18);
  ctx.fill();
  ctx.fillStyle = theme.accentLt;
  ctx.font = "bold 32px Cairo, sans-serif";
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(av, 86, 87);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px Cairo, sans-serif";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(personName, W - 50, 115);
  if (debt.title) {
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.font = "18px Cairo, sans-serif";
    ctx.fillText(debt.title, W - 50, 143);
  }
  const cx = 160, cy = 310, r = 100, lw = 14;
  const startAngle = -Math.PI * 0.75;
  const endAngle = Math.PI * 0.25;
  const fillAngle = startAngle + (endAngle - startAngle + Math.PI * 1.5) * (pct / 100);
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle + Math.PI * 1.5);
  ctx.stroke();
  const arcGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  arcGrad.addColorStop(0, theme.accent);
  arcGrad.addColorStop(1, theme.accentLt);
  ctx.strokeStyle = arcGrad;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, fillAngle);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px Cairo, sans-serif";
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(`${pct}%`, cx, cy + 14);
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.font = "18px Cairo, sans-serif";
  ctx.fillText("مسدّد", cx, cy + 40);
  const cells = [
    { label: "المبلغ الكلي", value: _fmt(debt.amount), color: "#ffffff", x: 330 },
    { label: "المدفوع", value: _fmt(paid), color: theme.accentLt, x: 530 },
    { label: "المتبقي", value: _fmt(debt.remaining), color: pct === 100 ? "#6ee7b7" : "#fca5a5", x: 730 }
  ];
  cells.forEach((c) => {
    ctx.fillStyle = "rgba(255,255,255,.08)";
    _roundRect(ctx, c.x - 80, 230, 160, 80, 14);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.font = "15px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText(c.label, c.x, 270);
    ctx.fillStyle = c.color;
    ctx.font = "bold 26px Cairo, sans-serif";
    ctx.fillText(`${c.value} ${currency2}`, c.x, 298);
  });
  const barX = 50, barY = 380, barW = W - 100, barH = 8;
  ctx.fillStyle = "rgba(255,255,255,.12)";
  _roundRect(ctx, barX, barY, barW, barH, 4);
  ctx.fill();
  const fillW = barW * pct / 100;
  const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  barGrad.addColorStop(0, theme.accent);
  barGrad.addColorStop(1, theme.accentLt);
  ctx.fillStyle = barGrad;
  _roundRect(ctx, barX, barY, fillW, barH, 4);
  ctx.fill();
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("ar-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
  ctx.fillStyle = "rgba(255,255,255,.3)";
  ctx.font = "15px Cairo, sans-serif";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillText(today, W - 50, 430);
  ctx.fillStyle = "rgba(255,255,255,.15)";
  ctx.font = "14px Cairo, sans-serif";
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText("GT-DAYN • سجل الديون الذكي", W / 2, 480);
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function _fmt(n) {
  return Math.round(n).toLocaleString("en-US");
}
let _fontLoaded = false;
async function _loadFont(ctx) {
  if (_fontLoaded) return;
  try {
    await document.fonts.load("bold 32px Cairo");
    _fontLoaded = true;
  } catch {
  }
}
async function downloadShareCard(debt, personName, currency2) {
  const blob = await generateShareCard(debt, personName, currency2);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${personName}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3e3);
}
async function shareCard(debt, personName, currency2) {
  var _a;
  const blob = await generateShareCard(debt, personName, currency2);
  if ((_a = navigator.canShare) == null ? void 0 : _a.call(navigator, { files: [new File([blob], "gt-dayn.png", { type: "image/png" })] })) {
    await navigator.share({
      files: [new File([blob], `${personName}.png`, { type: "image/png" })],
      title: `GT-DAYN — ${personName}`
    });
  } else {
    downloadShareCard(debt, personName, currency2);
  }
}
window.openCalc = window.openCalc || function() {
};
window.closeCalc = window.closeCalc || function() {
};
window.calcInput = window.calcInput || function() {
};
const _GT_DEL_LOCK_KEY = "gt-dayn-del-lock";
const _GT_EDIT_LOCK_KEY = "gt-dayn-edit-lock";
let _gtPwdResolve = null;
function _gtShowPwdConfirm(action) {
  return new Promise((resolve) => {
    _gtPwdResolve = resolve;
    const el = document.getElementById("pwd-confirm-action");
    if (el) el.textContent = action;
    const inp = document.getElementById("pwd-confirm-inp");
    if (inp) inp.value = "";
    const err = document.getElementById("pwd-confirm-err");
    if (err) err.textContent = "";
    openModal("pwd-confirm-modal");
    setTimeout(() => {
      var _a;
      return (_a = document.getElementById("pwd-confirm-inp")) == null ? void 0 : _a.focus();
    }, 150);
  });
}
window._GtSecure = {
  requirePwd(type, action) {
    const PWD_KEY = "gt-dayn-pwd-hash";
    const hash = localStorage.getItem(PWD_KEY);
    if (!hash) return Promise.resolve(true);
    const lockKey = type === "edit" ? _GT_EDIT_LOCK_KEY : _GT_DEL_LOCK_KEY;
    if (localStorage.getItem(lockKey) !== "true") return Promise.resolve(true);
    return _gtShowPwdConfirm(action);
  }
};
window._submitPwdConfirm = function() {
  var _a;
  const val = ((_a = document.getElementById("pwd-confirm-inp")) == null ? void 0 : _a.value) || "";
  const hash = localStorage.getItem("gt-dayn-pwd-hash");
  const b64 = btoa(unescape(encodeURIComponent(val + ":gt-dayn-2025")));
  if (b64 === hash) {
    closeAllModals();
    const r = _gtPwdResolve;
    _gtPwdResolve = null;
    r && r(true);
  } else {
    const err = document.getElementById("pwd-confirm-err");
    if (err) err.textContent = "كلمة المرور غير صحيحة ❌";
    const inp = document.getElementById("pwd-confirm-inp");
    if (inp) {
      inp.value = "";
      inp.focus();
    }
  }
};
window._cancelPwdConfirm = function() {
  closeAllModals();
  const r = _gtPwdResolve;
  _gtPwdResolve = null;
  r && r(false);
};
function _gtUpdateLockUI() {
  const hash = localStorage.getItem("gt-dayn-pwd-hash");
  const hasPwd = !!hash;
  const delOn = hasPwd && localStorage.getItem(_GT_DEL_LOCK_KEY) === "true";
  const editOn = hasPwd && localStorage.getItem(_GT_EDIT_LOCK_KEY) === "true";
  const dlSt = document.getElementById("del-lock-status");
  const dlTg = document.getElementById("del-lock-toggle");
  const edSt = document.getElementById("edit-lock-status");
  const edTg = document.getElementById("edit-lock-toggle");
  if (dlSt) {
    dlSt.textContent = delOn ? "مفعّل ✓" : "غير مفعّل";
    dlSt.style.color = delOn ? "#10b981" : "";
  }
  if (dlTg) dlTg.classList.toggle("on", delOn);
  if (edSt) {
    edSt.textContent = editOn ? "مفعّل ✓" : "غير مفعّل";
    edSt.style.color = editOn ? "#10b981" : "";
  }
  if (edTg) edTg.classList.toggle("on", editOn);
}
window.toggleDeleteLock = async function() {
  const hash = localStorage.getItem("gt-dayn-pwd-hash");
  if (!hash) {
    toast("يجب تعيين كلمة مرور أولاً", "info");
    openPwdSetup();
    return;
  }
  const cur = localStorage.getItem(_GT_DEL_LOCK_KEY) === "true";
  if (cur) {
    if (!await _gtShowPwdConfirm("إيقاف قفل الحذف")) return;
  }
  localStorage.setItem(_GT_DEL_LOCK_KEY, cur ? "false" : "true");
  _gtUpdateLockUI();
  toast(cur ? "تم إيقاف قفل الحذف" : "تم تفعيل قفل الحذف ✓", cur ? "info" : "success");
};
window.toggleEditLock = async function() {
  const hash = localStorage.getItem("gt-dayn-pwd-hash");
  if (!hash) {
    toast("يجب تعيين كلمة مرور أولاً", "info");
    openPwdSetup();
    return;
  }
  const cur = localStorage.getItem(_GT_EDIT_LOCK_KEY) === "true";
  if (cur) {
    if (!await _gtShowPwdConfirm("إيقاف قفل التعديل")) return;
  }
  localStorage.setItem(_GT_EDIT_LOCK_KEY, cur ? "false" : "true");
  _gtUpdateLockUI();
  toast(cur ? "تم إيقاف قفل التعديل" : "تم تفعيل قفل التعديل ✓", cur ? "info" : "success");
};
window.toggleInlineNewPerson = function() {
  const el = document.getElementById("inline-new-person");
  if (!el) return;
  el.style.display = el.style.display === "none" || !el.style.display ? "block" : "none";
  if (el.style.display !== "none")
    setTimeout(() => {
      var _a;
      return (_a = document.getElementById("inline-person-name")) == null ? void 0 : _a.focus();
    }, 50);
};
window.saveInlinePerson = async function() {
  var _a, _b;
  const name = (_a = document.getElementById("inline-person-name")) == null ? void 0 : _a.value.trim();
  const phone = (_b = document.getElementById("inline-person-phone")) == null ? void 0 : _b.value.trim();
  if (!name) {
    toast("يرجى كتابة اسم الشخص", "error");
    return;
  }
  try {
    await waitForApp();
    const id = await app.debts.addPerson({ name, phone: phone || null });
    const sel = document.getElementById("debt-person-select");
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name + (phone ? ` — ${phone}` : "");
    opt.selected = true;
    sel.appendChild(opt);
    document.getElementById("inline-new-person").style.display = "none";
    document.getElementById("inline-person-name").value = "";
    document.getElementById("inline-person-phone").value = "";
    toast(`تمت إضافة ${name} ✓`, "success");
  } catch (e) {
    toast("فشل الإضافة: " + e.message, "error");
  }
};
document.addEventListener("gt-dayn:ready", () => _gtUpdateLockUI());
document.addEventListener("gt-settings:rendered", () => _gtUpdateLockUI());
let appReadyPromiseResolve;
const appReadyPromise = new Promise((resolve) => {
  appReadyPromiseResolve = resolve;
});
window.addEventListener("gt-dayn:ready", () => {
  console.log("✅ التطبيق جاهز");
  appReadyPromiseResolve();
});
document.addEventListener("gt-dayn:ready", () => {
  if (typeof _setupAutoBackupTriggers === "function") {
    setTimeout(_setupAutoBackupTriggers, 1e3);
  }
  if (typeof _updateAutoBackupUI === "function") _updateAutoBackupUI();
  if (typeof _gtUpdateLockUI === "function") _gtUpdateLockUI();
});
async function waitForApp() {
  await appReadyPromise;
  if (!app.db) throw new Error("app.db غير معرف");
  if (!app.debts) throw new Error("app.debts غير معرف");
  if (!app.budget) throw new Error("app.budget غير معرف");
  if (!app.drive) throw new Error("app.drive غير معرف");
}
function formatDateLatin(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).replace(/\//g, "-");
}
let currentPage = "debts";
let debtFilter = "all";
let schedFreq = "monthly";
let debtType = "receivable";
let editDebtId = null;
let editPersonId = null;
let schedDebtId = null;
let currency = "د.م";
let currentMonth = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
let editCatId = null;
let chartInstance = null;
const STORAGE_KEY = "gt-dayn-backup";
async function saveDataToStorage() {
  try {
    await waitForApp();
    const [
      persons,
      debts,
      payments,
      scheduled,
      budget,
      categories,
      expenses,
      settings
    ] = await Promise.all([
      app.db.query("SELECT * FROM persons"),
      app.db.query("SELECT * FROM debts"),
      app.db.query("SELECT * FROM payments"),
      app.db.query("SELECT * FROM scheduled_payments"),
      app.db.query("SELECT * FROM budget_months"),
      app.db.query("SELECT * FROM budget_categories"),
      app.db.query("SELECT * FROM budget_expenses"),
      app.db.query("SELECT * FROM settings")
    ]);
    const data = JSON.stringify({
      version: "1.0.0",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      persons,
      debts,
      payments,
      scheduled,
      budget,
      categories,
      expenses,
      settings
    });
    localStorage.setItem(STORAGE_KEY, data);
    return true;
  } catch (e) {
    console.warn("⚠️ فشل حفظ البيانات:", e);
    return false;
  }
}
async function loadDataFromStorage() {
  var _a;
  try {
    await waitForApp();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    const data = JSON.parse(saved);
    const personsCount = await app.db.query("SELECT COUNT(*) as count FROM persons");
    if (((_a = personsCount[0]) == null ? void 0 : _a.count) > 0) return false;
    toast("جاري استعادة البيانات المحفوظة...", "info");
    for (const p of data.persons ?? []) {
      await app.db.run(
        `INSERT OR IGNORE INTO persons (id,name,avatar,phone,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
        [p.id, p.name, p.avatar, p.phone, p.note, p.created_at, p.updated_at]
      );
    }
    for (const d of data.debts ?? []) {
      await app.db.run(
        `INSERT OR IGNORE INTO debts (id,person_id,type,title,amount,remaining,note,status,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [d.id, d.person_id, d.type, d.title, d.amount, d.remaining, d.note, d.status, d.sort_order, d.created_at, d.updated_at]
      );
    }
    for (const p of data.payments ?? []) {
      await app.db.run(
        `INSERT OR IGNORE INTO payments (id,debt_id,amount,note,paid_at,created_at) VALUES (?,?,?,?,?,?)`,
        [p.id, p.debt_id, p.amount, p.note, p.paid_at, p.created_at]
      );
    }
    for (const s of data.scheduled ?? []) {
      await app.db.run(
        `INSERT OR IGNORE INTO scheduled_payments (id,debt_id,amount,due_date,status,created_at) VALUES (?,?,?,?,?,?)`,
        [s.id, s.debt_id, s.amount, s.due_date, s.status, s.created_at]
      );
    }
    for (const bm of data.budget ?? []) {
      await app.db.run(
        `INSERT OR IGNORE INTO budget_months (id,month,income,spent,note,created_at) VALUES (?,?,?,?,?,?)`,
        [bm.id, bm.month, bm.income, bm.spent, bm.note, bm.created_at]
      );
    }
    for (const c of data.categories ?? []) {
      await app.db.run(
        `INSERT OR IGNORE INTO budget_categories (id,month_id,name,icon,color,budget_cap,due_day,sort_order,linked_type) VALUES (?,?,?,?,?,?,?,?,?)`,
        [c.id, c.month_id, c.name, c.icon, c.color, c.budget_cap, c.due_day, c.sort_order, c.linked_type]
      );
    }
    for (const ex of data.expenses ?? []) {
      await app.db.run(
        `INSERT OR IGNORE INTO budget_expenses (id,category_id,month_id,amount,note,expense_date,payment_id,created_at) VALUES (?,?,?,?,?,?,?,?)`,
        [ex.id, ex.category_id, ex.month_id, ex.amount, ex.note, ex.expense_date, ex.payment_id, ex.created_at]
      );
    }
    for (const s of data.settings ?? []) {
      await app.db.run(`INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)`, [s.key, s.value]);
    }
    toast("✅ تم استعادة البيانات بنجاح", "success");
    return true;
  } catch (e) {
    console.warn("⚠️ فشل استعادة البيانات:", e);
  }
  return false;
}
window.toggleSettingsDropdown = function(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById("settings-dropdown");
  dropdown.classList.toggle("active");
  updateDropdownStatus();
};
document.addEventListener("click", function(e) {
  const dd = document.getElementById("settings-dropdown");
  const btn = document.getElementById("btn-menu");
  if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
    dd.classList.remove("active");
  }
});
window.updateDropdownStatus = function() {
  document.getElementById("dropdown-drive-status");
  const themeStatus = document.getElementById("dropdown-theme");
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  themeStatus.textContent = isDark ? "داكن" : "فاتح";
};
app.init().catch((error) => {
  console.error("❌ فشل تهيئة التطبيق:", error);
  toast("فشل تحميل التطبيق", "error");
  const ls = document.getElementById("loading-screen");
  if (ls) {
    ls.style.opacity = "0";
    setTimeout(() => ls.remove(), 420);
  }
});
window.addEventListener("gt-dayn:ready", async () => {
  var _a, _b;
  console.log("✅ التطبيق جاهز");
  try {
    const settings = await app.db.query(`SELECT key,value FROM settings`);
    const savedTheme = (_a = settings.find((s) => s.key === "theme")) == null ? void 0 : _a.value;
    const savedCurrency = (_b = settings.find((s) => s.key === "currency_sym")) == null ? void 0 : _b.value;
    if (savedTheme) {
      applySavedOrSystemTheme(savedTheme);
    } else {
      applySavedOrSystemTheme("auto");
      await app.db.run(`UPDATE settings SET value='auto' WHERE key='theme'`);
    }
    if (savedCurrency) {
      currency = savedCurrency;
    } else {
      currency = "د.م";
      await app.db.run(`UPDATE settings SET value='MAD' WHERE key='currency'`);
      await app.db.run(`UPDATE settings SET value='د.م' WHERE key='currency_sym'`);
    }
    const curObj = CURRENCIES.find((c) => c.sym === currency) || { sym: currency, code: "" };
    document.getElementById("currency-lbl").textContent = `${curObj.sym} (${curObj.code})`;
    document.getElementById("dropdown-currency").textContent = curObj.sym;
    updateThemeToggle();
    updateDropdownStatus();
    await loadDataFromStorage();
    await renderCurrentPage();
    initViewportFix([".modal-overlay"]);
    setInterval(saveDataToStorage, 3e4);
    window.addEventListener("beforeunload", saveDataToStorage);
    const ls = document.getElementById("loading-screen");
    if (ls) {
      ls.style.opacity = "0";
      setTimeout(() => ls.remove(), 420);
    }
  } catch (e) {
    console.error("خطأ في التهيئة:", e);
    toast("حدث خطأ في تحميل التطبيق", "error");
    const ls = document.getElementById("loading-screen");
    if (ls) {
      ls.style.opacity = "0";
      setTimeout(() => ls.remove(), 420);
    }
  }
});
window.navigateTo = async function(page) {
  var _a;
  await waitForApp();
  document.querySelectorAll(".page").forEach((p) => p.style.display = "none");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById(`page-${page}`).style.display = "";
  (_a = document.getElementById(`nav-${page}`)) == null ? void 0 : _a.classList.add("active");
  document.getElementById("btn-search").style.display = page === "debts" ? "" : "none";
  currentPage = page;
  await renderCurrentPage();
  if (page === "statistics") renderStatistics();
};
async function renderCurrentPage() {
  await waitForApp();
  if (currentPage === "debts") await renderDebts();
  else if (currentPage === "persons") await renderPersons();
  else if (currentPage === "budget") await renderBudget();
  else if (currentPage === "settings") await renderSettings();
  else if (currentPage === "statistics") renderStatistics();
  else if (currentPage === "person-profile") await renderProfileDebts();
}
window.openSearch = function() {
  document.querySelector(".header-title-wrapper").style.display = "none";
  document.getElementById("search-bar").classList.add("active");
  document.getElementById("btn-search").style.display = "none";
  setTimeout(() => document.getElementById("search-input").focus(), 50);
};
window.closeSearch = async function() {
  document.querySelector(".header-title-wrapper").style.display = "";
  document.getElementById("search-bar").classList.remove("active");
  document.getElementById("btn-search").style.display = "";
  document.getElementById("search-input").value = "";
  await waitForApp();
  await renderDebts();
};
window.onSearch = async function(q) {
  await waitForApp();
  const container = document.getElementById("debts-container");
  if (!q.trim()) {
    await renderDebts();
    return;
  }
  const qLow = q.trim().toLowerCase();
  const debts = await app.debts.getDebts();
  const persons = await app.debts.getPersons();
  const matchedPersonIds = new Set(
    persons.filter(
      (p) => (p.name || "").toLowerCase().includes(qLow) || (p.phone || "").toLowerCase().includes(qLow) || (p.note || "").toLowerCase().includes(qLow)
    ).map((p) => p.id)
  );
  const filtered = debts.filter(
    (d) => (d.person_name || "").toLowerCase().includes(qLow) || (d.title || "").toLowerCase().includes(qLow) || (d.note || "").toLowerCase().includes(qLow) || String(d.amount).includes(q) || String(d.remaining).includes(q) || matchedPersonIds.has(d.person_id)
  );
  renderDebtCards(filtered, container);
};
async function renderDebts() {
  await waitForApp();
  const s = await app.debts.getSummary();
  document.getElementById("b-receivable").textContent = fmt(s.totalReceivable, currency);
  document.getElementById("b-payable").textContent = fmt(s.totalPayable, currency);
  const netEl = document.getElementById("b-net");
  netEl.textContent = fmt(Math.abs(s.net), currency);
  netEl.className = "b-val " + (s.net >= 0 ? "net-pos" : "net-neg");
  const date = /* @__PURE__ */ new Date();
  document.getElementById("banner-month").textContent = date.toLocaleDateString("en-US", { month: "long", year: "numeric" }).replace(/(\w+)\s(\d+)/, (_, m, y) => {
    const AR = { January: "يناير", February: "فبراير", March: "مارس", April: "أبريل", May: "مايو", June: "يونيو", July: "يوليو", August: "أغسطس", September: "سبتمبر", October: "أكتوبر", November: "نوفمبر", December: "ديسمبر" };
    return (AR[m] || m) + " " + y;
  });
  await renderDue();
  let opts = {};
  if (debtFilter === "receivable") opts = { type: "receivable" };
  else if (debtFilter === "payable") opts = { type: "payable" };
  else if (debtFilter === "done") opts = { status: "done" };
  else if (debtFilter === "archived") opts = { status: "archived" };
  const debts = await app.debts.getDebts(opts);
  renderDebtCards(debts, document.getElementById("debts-container"));
}
function renderDebtCards(debts, container) {
  container.innerHTML = "";
  if (!debts.length) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>لا توجد ديون حتى الآن</p></div>`;
    return;
  }
  debts.forEach((d, i) => {
    const pct = Math.min(100, Math.round((d.amount - d.remaining) / d.amount * 100));
    const paid = d.amount - d.remaining;
    const done = d.status === "done";
    const [bg, fg] = avatarColor(d.person_name);
    const card = document.createElement("div");
    card.className = "debt-card fade-up";
    card.dataset.id = d.id;
    card.dataset.type = d.type;
    card.draggable = true;
    card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = `
        <div class="card-top">
          <div class="avatar" style="background:${bg};color:${fg};">${initial(d.person_name)}</div>
          <div>
            <div class="card-name">${d.person_name}</div>
            ${d.title ? `<div class="card-note">${d.title}</div>` : ""}
          </div>
          <div class="type-badge ${d.type}">${d.type === "receivable" ? "لي عند" : "عليّ"}</div>
          ${d.status === "done" ? '<div class="status-badge-done">✅ مكتمل</div>' : ""}
          ${d.status === "archived" ? '<div class="status-badge-arch">🗂 مؤرشَف</div>' : ""}
          <div class="card-amount ${done ? "done" : ""}">${done ? "✓" : fmt(d.remaining, d.currency || currency)}</div>
        </div>
        <div class="progress-lbl">
          <span class="pct">${pct}% مسدّد</span>
          <span class="orig">من ${fmt(d.amount, d.currency || currency)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${done ? "done" : ""}" style="width:${pct}%"></div>
        </div>
        <div class="history-panel" id="hist-${d.id}">
          <div class="amounts-row">
            <div class="amount-cell">
              <div class="ac-lbl">الكلي</div>
              <div class="ac-val">${fmt(d.amount, d.currency || currency)}</div>
            </div>
            <div class="amount-cell ac-blue">
              <div class="ac-lbl">المدفوع</div>
              <div class="ac-val">${fmt(paid, d.currency || currency)}</div>
            </div>
            <div class="amount-cell ${done ? "ac-green" : ""}">
              <div class="ac-lbl">المتبقي</div>
              <div class="ac-val">${fmt(d.remaining, d.currency || currency)}</div>
            </div>
          </div>
          <div id="payments-${d.id}"></div>
          <div class="btn-group" onclick="event.stopPropagation()">
            ${done ? `<button class="bcard" style="background:rgba(16,185,129,.15);color:#10b981;flex:2;" onclick="event.stopPropagation();">
                   <i class="fa-solid fa-circle-check"></i> مكتمل
                 </button>
                 <button class="bcard bcard-del" onclick="archiveDebt(${d.id})" title="أرشفة" style="font-size:.72rem;">
                   <i class="fa-solid fa-box-archive"></i>
                 </button>` : `<button class="bcard bcard-pay" onclick="openPayModal(${d.id})"><i class="fa-solid fa-money-bill-transfer"></i> تسديد</button>`}
            <button class="bcard bcard-sched" onclick="openScheduleModal(${d.id})" title="جدولة"><i class="fa-solid fa-calendar-days"></i></button>
            <button class="bcard bcard-share" onclick="openEditDebtModal(${d.id})" title="تعديل" style="background:rgba(129,140,248,.15);color:#818cf8;border:1px solid rgba(129,140,248,.3);"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="bcard bcard-share" onclick="doShare(${d.id})" title="مشاركة"><i class="fa-solid fa-share-nodes"></i></button>
            ${d.status === "archived" ? `<button class="bcard" style="background:rgba(16,185,129,.12);color:#10b981;" onclick="restoreDebt(${d.id})" title="استعادة"><i class="fa-solid fa-rotate-left"></i></button>` : ""}
            <button class="bcard bcard-del" onclick="doDelete(${d.id})" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`;
    card.addEventListener("click", () => toggleHistory(d.id));
    container.appendChild(card);
  });
  if (initDragSort) {
    initDragSort(container, async (ids) => {
      await waitForApp();
      for (let i = 0; i < ids.length; i++) await app.debts.updateDebt(ids[i], { sort_order: i });
    });
  }
}
async function toggleHistory(id) {
  await waitForApp();
  const panel = document.getElementById(`hist-${id}`);
  if (!panel) return;
  const open = panel.style.display === "block";
  document.querySelectorAll(".history-panel").forEach((p) => p.style.display = "none");
  if (!open) {
    panel.style.display = "block";
    await loadPayments(id);
  }
}
async function loadPayments(debtId) {
  await waitForApp();
  const container = document.getElementById(`payments-${debtId}`);
  if (!container) return;
  const [payments, scheduled, edits] = await Promise.all([
    app.debts.getPayments(debtId),
    app.debts.getScheduled(debtId),
    app.db.query(`SELECT * FROM debt_edits WHERE debt_id=? ORDER BY edited_at DESC`, [debtId]).catch(() => [])
  ]);
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const FIELD_LABELS = { amount: "المبلغ", type: "النوع", title: "الوصف" };
  container.innerHTML = `
      <div class="hist-list">
        <div class="hist-hdr">سجل الدفعات</div>
        ${!payments.length && !scheduled.length ? '<p style="font-size:.76rem;color:var(--text-3);text-align:center;padding:4px 0;">لا توجد دفعات</p>' : payments.map((p) => `
          <div class="hist-item" onclick="event.stopPropagation();openEditPayModal(${p.id},${debtId})">
            <span class="hist-amt">${fmt(p.amount, currency)}</span>
            ${p.note ? `<span class="hist-note">${p.note}</span>` : ""}
            <span class="hist-date">${formatDateLatin(p.paid_at)}</span>
          </div>`).join("") + scheduled.map((s) => {
    const due = new Date(s.due_date) <= today;
    return `<div class="hist-item" onclick="event.stopPropagation();openDueModal(${debtId},${s.id})">
              <span class="hist-amt ${due ? "due" : "scheduled"}">${fmt(s.amount, currency)}</span>
              <span class="sched-badge">${due ? "مستحقة" : "مجدولة"}</span>
              <span class="hist-date">${s.due_date}</span>
            </div>`;
  }).join("")}
      </div>
      ${edits.length ? `
      <div class="hist-list" style="margin-top:6px;border-top:2px dashed var(--border);">
        <div class="hist-hdr" style="color:var(--warning,#d97706);">
          <i class="fa-solid fa-pen-to-square" style="margin-left:4px;"></i>سجل التعديلات
        </div>
        ${edits.map((e) => {
    var _a;
    const label = FIELD_LABELS[e.field] || e.field;
    const isAmount = e.field === "amount";
    const diff = isAmount ? +e.new_value - +e.old_value : null;
    const diffStr = diff !== null ? diff >= 0 ? `<span style="color:#10b981;">+${fmt(diff, currency)}</span>` : `<span style="color:#f87171;">${fmt(diff, currency)}</span>` : "";
    return `<div class="hist-item" style="flex-wrap:wrap;gap:4px;">
            <span class="hist-amt" style="color:var(--text-3);font-size:.7rem;">${label}</span>
            <span style="font-size:.72rem;color:var(--text-3);">
              <span style="text-decoration:line-through;">${isAmount ? fmt(+e.old_value, currency) : e.old_value}</span>
              → <strong style="color:var(--text);">${isAmount ? fmt(+e.new_value, currency) : e.new_value}</strong>
              ${diffStr}
            </span>
            <span class="hist-date" style="width:100%;font-size:.65rem;">${((_a = e.edited_at) == null ? void 0 : _a.slice(0, 16).replace("T", " ")) || ""}</span>
          </div>`;
  }).join("")}
      </div>` : ""}`;
}
async function renderDue() {
  await waitForApp();
  const container = document.getElementById("due-container");
  const dues = await app.debts.getDueToday();
  container.innerHTML = dues.map((d) => `
      <div class="due-notif" onclick="openPayModalForScheduled(${d.debt_id},${d.id},${d.amount})">
        <div class="due-notif-info">
          <span class="due-notif-name">
            <i class="fa-solid fa-clock" style="color:#f87171;margin-left:5px;font-size:.75rem;"></i>
            ${d.person_name} — ${d.debt_title}
          </span>
          <span class="due-notif-amt">دفعة مستحقة: ${fmt(d.amount, d.currency || currency)}</span>
        </div>
        <button onclick="event.stopPropagation();this.parentElement.remove();" style="background:none;border:none;color:var(--text-3);font-size:1rem;cursor:pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>`).join("");
}
window.setDebtFilter = async function(filter, btn) {
  await waitForApp();
  debtFilter = filter;
  document.querySelectorAll("#debt-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const archBar = document.getElementById("archive-search-bar");
  if (archBar) {
    archBar.style.display = filter === "done" || filter === "archived" ? "" : "none";
    const inp = document.getElementById("archive-search-inp");
    if (inp) inp.value = "";
  }
  await renderDebts();
};
window.onArchiveSearch = async function(q) {
  await waitForApp();
  const container = document.getElementById("debts-container");
  const qL = q.trim().toLowerCase();
  let opts = {};
  if (debtFilter === "done") opts.status = "done";
  if (debtFilter === "archived") opts.status = "archived";
  const all = await app.debts.getDebts(opts);
  const persons = await app.debts.getPersons();
  if (!qL) {
    renderDebtCards(all, container);
    return;
  }
  const matchedIds = new Set(
    persons.filter(
      (p) => (p.name || "").toLowerCase().includes(qL) || (p.phone || "").toLowerCase().includes(qL)
    ).map((p) => p.id)
  );
  const filtered = all.filter(
    (d) => (d.person_name || "").toLowerCase().includes(qL) || (d.title || "").toLowerCase().includes(qL) || (d.note || "").toLowerCase().includes(qL) || String(d.amount).includes(q) || (d.created_at || "").includes(q) || matchedIds.has(d.person_id)
  );
  renderDebtCards(filtered, container);
};
window.openEditDebtModal = async function(debtId) {
  await waitForApp();
  const debt = await app.debts.getDebt(debtId);
  if (!debt) {
    toast("لم يُعثر على الدين", "error");
    return;
  }
  editDebtId = debtId;
  document.getElementById("add-debt-title").textContent = "تعديل الدين";
  document.getElementById("debt-title-inp").value = debt.title || "";
  document.getElementById("debt-amount-inp").value = debt.amount;
  document.getElementById("debt-note-inp").value = debt.note || "";
  document.getElementById("debt-currency-select").value = debt.currency || "";
  debtType = debt.type;
  document.getElementById("dtype-rec").classList.toggle("active", debt.type === "receivable");
  document.getElementById("dtype-pay").classList.toggle("active", debt.type === "payable");
  await populatePersonSelect(debt.person_id);
  await populateCurrencySelect(debt.currency);
  openModal("add-debt-modal");
};
window.openAddDebtModal = async function(personId = null) {
  await waitForApp();
  editDebtId = null;
  document.getElementById("add-debt-title").textContent = "دين جديد";
  document.getElementById("debt-title-inp").value = "";
  document.getElementById("debt-amount-inp").value = "";
  document.getElementById("debt-note-inp").value = "";
  document.getElementById("debt-currency-select").value = "";
  debtType = "receivable";
  document.getElementById("dtype-rec").classList.add("active");
  document.getElementById("dtype-pay").classList.remove("active");
  await populatePersonSelect(personId);
  await populateCurrencySelect("");
  openModal("add-debt-modal");
};
window.setDebtType = function(t) {
  debtType = t;
  document.getElementById("dtype-rec").classList.toggle("active", t === "receivable");
  document.getElementById("dtype-pay").classList.toggle("active", t === "payable");
};
async function populatePersonSelect(selected = null) {
  await waitForApp();
  const persons = await app.debts.getPersons();
  const sel = document.getElementById("debt-person-select");
  sel.innerHTML = `<option value="">-- اختر شخصاً --</option>`;
  persons.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (selected && p.id == selected) opt.selected = true;
    sel.appendChild(opt);
  });
}
async function populateCurrencySelect(selected = null) {
  const sel = document.getElementById("debt-currency-select");
  if (!sel) return;
  sel.innerHTML = `<option value="">الافتراضية (${currency})</option>`;
  CURRENCIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.sym;
    opt.textContent = `${c.flag} ${c.sym} — ${c.name}`;
    if (selected && (c.sym === selected || c.code === selected)) opt.selected = true;
    sel.appendChild(opt);
  });
}
window.saveDebt = async function() {
  var _a;
  await waitForApp();
  if (editDebtId && window._GtSecure && !await window._GtSecure.requirePwd("edit", "تعديل الدين")) return;
  const personId = +document.getElementById("debt-person-select").value;
  const title = document.getElementById("debt-title-inp").value.trim();
  const amount = +document.getElementById("debt-amount-inp").value;
  const note = document.getElementById("debt-note-inp").value.trim();
  const currVal = ((_a = document.getElementById("debt-currency-select")) == null ? void 0 : _a.value) || "";
  const debtCurrency = currVal || currency || "MAD";
  if (!personId || !title || !amount || amount <= 0) {
    toast("يرجى تعبئة جميع الحقول", "error");
    return;
  }
  try {
    if (editDebtId) {
      const _eid = editDebtId;
      const _old = await app.debts.getDebt(_eid).catch(() => null);
      await app.debts.updateDebt(_eid, { title, amount, note: note || null, type: debtType, currency: debtCurrency });
      const _upd = await app.debts.getDebt(_eid).catch(() => null);
      if (_old && _upd) {
        if (_old.amount !== _upd.amount) recordDebtEdit(_eid, "amount", _old.amount, _upd.amount).catch(() => {
        });
        if (_old.type !== _upd.type) recordDebtEdit(
          _eid,
          "type",
          _old.type === "receivable" ? "لي عند" : "عليّ",
          _upd.type === "receivable" ? "لي عند" : "عليّ"
        ).catch(() => {
        });
        if (_old.title !== _upd.title) recordDebtEdit(_eid, "title", _old.title, _upd.title).catch(() => {
        });
      }
    } else {
      await app.debts.addDebt({ personId, type: debtType, title, amount, note: note || null, currency: debtCurrency || "MAD" });
    }
    closeAllModals();
    toast("تم الحفظ ✓", "success");
    await renderDebts();
  } catch (e) {
    toast("خطأ في الحفظ: " + (e.message || e), "error");
    console.error("[saveDebt]", e);
  }
};
window.openPayModal = function(debtId) {
  schedDebtId = null;
  document.getElementById("pay-title").textContent = "تسديد دفعة";
  document.getElementById("pay-subtitle").textContent = "";
  document.getElementById("pay-amount").value = "";
  document.getElementById("pay-note").value = "";
  document.getElementById("pay-date").value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  document.getElementById("pay-confirm-btn").onclick = () => confirmPay(debtId);
  openModal("pay-modal");
};
window.openPayModalForScheduled = function(debtId, schedId, amount) {
  document.getElementById("pay-amount").value = amount;
  document.getElementById("pay-confirm-btn").onclick = () => confirmPayScheduled(debtId, schedId, amount);
  openModal("pay-modal");
};
window.confirmPay = async function(debtId, schedId = null) {
  await waitForApp();
  const amount = +document.getElementById("pay-amount").value;
  const note = document.getElementById("pay-note").value.trim();
  const date = document.getElementById("pay-date").value;
  if (!amount || amount <= 0) {
    toast("أدخل مبلغاً صحيحاً", "error");
    return;
  }
  const payId = await app.debts.addPayment(debtId, { amount, note: note || null, paidAt: date || null });
  if (app.budget && app.budget.linkDebtPayment) {
    await app.budget.linkDebtPayment(payId, amount);
  }
  if (schedId) {
    await app.db.run(`UPDATE scheduled_payments SET status='paid' WHERE id=?`, [schedId]);
  }
  closeAllModals();
  toast("تم تسجيل الدفعة ✓", "success");
  await renderDebts();
};
window.confirmPayScheduled = async function(debtId, schedId, amount) {
  await confirmPay(debtId, schedId);
};
window.openEditPayModal = async function(payId, debtId) {
  await waitForApp();
  const pays = await app.db.query(`SELECT * FROM payments WHERE id=?`, [payId]);
  if (!pays.length) return;
  const p = pays[0];
  document.getElementById("epay-amount").value = p.amount;
  document.getElementById("epay-note").value = p.note ?? "";
  document.getElementById("epay-date").value = (p.paid_at ?? "").slice(0, 10);
  document.getElementById("epay-save-btn").onclick = async () => {
    await waitForApp();
    await app.debts.updatePayment(payId, {
      amount: +document.getElementById("epay-amount").value,
      note: document.getElementById("epay-note").value,
      paidAt: document.getElementById("epay-date").value
    });
    closeAllModals();
    toast("تم التعديل", "success");
    await renderDebts();
  };
  document.getElementById("epay-del-btn").onclick = async () => {
    if (window._GtSecure && !await window._GtSecure.requirePwd("delete", "حذف الدفعة")) return;
    await waitForApp();
    const pay = (await app.db.query(`SELECT * FROM payments WHERE id=?`, [payId]))[0];
    await app.debts.deletePayment(payId);
    closeAllModals();
    await renderDebts();
    const undid = await toastUndo(`تم حذف الدفعة ${fmt((pay == null ? void 0 : pay.amount) || 0, currency)}`, 5e3);
    if (undid && pay) {
      await app.db.run(
        `INSERT INTO payments (id,debt_id,amount,note,paid_at,created_at) VALUES (?,?,?,?,?,?)`,
        [pay.id, pay.debt_id, pay.amount, pay.note, pay.paid_at, pay.created_at]
      );
      toast("تم الاستعادة ✓", "success");
      await renderDebts();
    }
  };
  openModal("edit-pay-modal");
};
window.openScheduleModal = async function(debtId) {
  await waitForApp();
  schedDebtId = debtId;
  const d = await app.debts.getDebt(debtId);
  document.getElementById("schedule-sub").textContent = `${d.person_name} — ${fmt(d.remaining, currency)}`;
  document.getElementById("sched-count").value = "";
  document.getElementById("sched-start").value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  schedFreq = "monthly";
  document.querySelectorAll('[id^="sfreq-"]').forEach((b) => b.classList.remove("active"));
  document.getElementById("sfreq-monthly").classList.add("active");
  document.getElementById("sched-confirm-btn").onclick = confirmSchedule;
  openModal("schedule-modal");
};
window.setSchedFreq = function(f, btn) {
  schedFreq = f;
  document.querySelectorAll('[id^="sfreq-"]').forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
};
async function confirmSchedule() {
  await waitForApp();
  const count = +document.getElementById("sched-count").value;
  const start = document.getElementById("sched-start").value;
  if (!count || count < 1 || !start) {
    toast("أدخل عدد الدفعات والتاريخ", "error");
    return;
  }
  await app.debts.schedulePayments(schedDebtId, { count, startDate: start, freqType: schedFreq });
  closeAllModals();
  toast("تمت الجدولة ✓", "success");
  await renderDebts();
}
window.openDueModal = function(debtId, schedId) {
  openPayModalForScheduled(debtId, schedId, 0);
  app.db.query(`SELECT amount FROM scheduled_payments WHERE id=?`, [schedId]).then((r) => {
    if (r[0]) document.getElementById("pay-amount").value = r[0].amount;
    document.getElementById("pay-confirm-btn").onclick = () => {
      var _a;
      return confirmPayScheduled(debtId, schedId, (_a = r[0]) == null ? void 0 : _a.amount);
    };
  });
};
window.doDelete = async function(debtId) {
  await waitForApp();
  if (window._GtSecure && !await window._GtSecure.requirePwd("delete", "حذف الدين")) return;
  const debt = await app.debts.getDebt(debtId);
  if (!debt) return;
  await app.debts.deleteDebt(debtId);
  await renderDebts();
  const undid = await toastUndo(`تم حذف "${debt.title || debt.person_name}"`, 5e3);
  if (undid) {
    await app.db.run(
      `INSERT INTO debts (id,person_id,type,title,amount,remaining,note,status,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [debt.id, debt.person_id, debt.type, debt.title, debt.amount, debt.remaining, debt.note, debt.status, debt.sort_order, debt.created_at, debt.updated_at]
    );
    toast("تم الاستعادة ✓", "success");
    await renderDebts();
  }
};
window.doShare = async function(debtId) {
  await waitForApp();
  const d = await app.debts.getDebt(debtId);
  if (!d) return;
  toast("جاري تحضير البطاقة...");
  if (shareCard) {
    await shareCard(d, d.person_name, currency);
  }
};
async function renderPersons() {
  await waitForApp();
  const persons = await app.debts.getPersons();
  const container = document.getElementById("persons-container");
  container.innerHTML = "";
  if (!persons.length) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users"></i><p>لا يوجد أشخاص</p><p style="font-size:.78rem;margin-top:8px;">أضف شخصاً أولاً ثم أنشئ ديناً</p></div>`;
    return;
  }
  persons.forEach((p, i) => {
    const [bg, fg] = avatarColor(p.name);
    const net = p.net_balance;
    const card = document.createElement("div");
    card.className = "person-card fade-up";
    card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = `
        <div class="person-top">
          <div class="avatar" style="background:${bg};color:${fg};width:42px;height:42px;border-radius:12px;">${initial(p.name)}</div>
          <div style="flex:1;">
            <div class="person-name">${p.name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:1px;">
              <div class="person-count">${p.active_count || 0} معاملة نشطة</div>
              ${p.phone ? `<button class="__copy-phone" data-phone="${p.phone}"
                style="background:none;border:1px solid var(--border);border-radius:6px;padding:1px 7px;font-size:.6rem;color:var(--text-3);cursor:pointer;font-family:var(--font);">
                <i class="fa-solid fa-phone"></i> نسخ
              </button>` : ""}
            </div>
          </div>
          <div class="net-badge ${net > 0 ? "net-pos" : net < 0 ? "net-neg" : "net-zero"}">
            ${net > 0 ? "+" : ""}${fmt(net, currency)}
          </div>
          <button class="__edit-person-btn" data-pid="${p.id}"
            style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 9px;color:var(--text-3);cursor:pointer;font-size:.82rem;flex-shrink:0;margin-right:4px;"
            title="تعديل الشخص">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </div>
        <div class="person-stats">
          <div class="pstat">
            <div class="pstat-lbl">لي عنده</div>
            <div class="pstat-val" style="color:#818cf8;">${fmt(p.receivable_total || 0, currency)}</div>
          </div>
          <div class="pstat">
            <div class="pstat-lbl">عليّ له</div>
            <div class="pstat-val" style="color:#f87171;">${fmt(p.payable_total || 0, currency)}</div>
          </div>
          <div class="pstat">
            <div class="pstat-lbl">الصافي</div>
            <div class="pstat-val" style="color:${net >= 0 ? "#10b981" : "#f87171"};">${fmt(Math.abs(net), currency)}</div>
          </div>
        </div>`;
    const copyBtn = card.querySelector(".__copy-phone");
    if (copyBtn) {
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const ph = copyBtn.dataset.phone;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(ph).then(() => toast("تم نسخ الرقم ✓", "success"));
        } else {
          const ta = document.createElement("textarea");
          ta.value = ph;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          toast("تم نسخ الرقم ✓", "success");
        }
      });
    }
    card.querySelector(".__edit-person-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditPersonModal(p);
    });
    card.addEventListener("click", () => openPersonProfile(p));
    container.appendChild(card);
  });
}
window.openAddPersonModal = function() {
  editPersonId = null;
  document.getElementById("person-modal-title").textContent = "شخص جديد";
  ["person-name-inp", "person-phone-inp", "person-note-inp"].forEach((id) => document.getElementById(id).value = "");
  document.getElementById("person-del-btn").style.display = "none";
  document.getElementById("person-save-btn").onclick = savePerson;
  openModal("person-modal");
};
function openEditPersonModal(p) {
  editPersonId = p.id;
  document.getElementById("person-modal-title").textContent = "تعديل الشخص";
  document.getElementById("person-name-inp").value = p.name;
  document.getElementById("person-phone-inp").value = p.phone ?? "";
  document.getElementById("person-note-inp").value = p.note ?? "";
  document.getElementById("person-del-btn").style.display = "";
  document.getElementById("person-save-btn").onclick = savePerson;
  openModal("person-modal");
}
window.deletePerson = async function() {
  if (!editPersonId) return;
  if (window._GtSecure && !await window._GtSecure.requirePwd("delete", "حذف الشخص وجميع ديونه")) return;
  await waitForApp();
  const persons = await app.debts.getPersons();
  const person = persons.find((p) => p.id === editPersonId);
  const debts = await app.debts.getDebts({ personId: editPersonId });
  const snapshot = { debts: [] };
  for (const d of debts) {
    const payments = await app.debts.getPayments(d.id);
    const scheduled = await app.debts.getScheduled(d.id);
    snapshot.debts.push({ ...d, payments, scheduled });
  }
  for (const d of debts) {
    await app.db.run(`DELETE FROM scheduled_payments WHERE debt_id=?`, [d.id]);
    await app.db.run(`DELETE FROM payments WHERE debt_id=?`, [d.id]);
  }
  await app.db.run(`DELETE FROM debts WHERE person_id=?`, [editPersonId]);
  await app.db.run(`DELETE FROM persons WHERE id=?`, [editPersonId]);
  closeAllModals();
  await renderPersons();
  const undid = await toastUndo(`تم حذف "${person == null ? void 0 : person.name}"`, 5e3);
  if (undid) {
    await app.db.run(
      `INSERT INTO persons (id,name,avatar,phone,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
      [person.id, person.name, person.avatar, person.phone, person.note, person.created_at, person.updated_at]
    );
    for (const d of snapshot.debts) {
      await app.db.run(
        `INSERT INTO debts (id,person_id,type,title,amount,remaining,note,status,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [d.id, d.person_id, d.type, d.title, d.amount, d.remaining, d.note, d.status, d.sort_order, d.created_at, d.updated_at]
      );
      for (const p of d.payments) {
        await app.db.run(
          `INSERT INTO payments (id,debt_id,amount,note,paid_at,created_at) VALUES (?,?,?,?,?,?)`,
          [p.id, p.debt_id, p.amount, p.note, p.paid_at, p.created_at]
        );
      }
      for (const s of d.scheduled) {
        await app.db.run(
          `INSERT INTO scheduled_payments (id,debt_id,amount,due_date,status,created_at) VALUES (?,?,?,?,?,?)`,
          [s.id, s.debt_id, s.amount, s.due_date, s.status, s.created_at]
        );
      }
    }
    toast("تم الاستعادة ✓", "success");
    await renderPersons();
  }
};
async function savePerson() {
  await waitForApp();
  if (editPersonId && window._GtSecure && !await window._GtSecure.requirePwd("edit", "تعديل بيانات الشخص")) return;
  const name = document.getElementById("person-name-inp").value.trim();
  const phone = document.getElementById("person-phone-inp").value.trim();
  const note = document.getElementById("person-note-inp").value.trim();
  if (!name) {
    toast("أدخل الاسم", "error");
    return;
  }
  try {
    if (editPersonId) {
      await app.debts.updatePerson(editPersonId, { name, phone: phone || null, note: note || null });
    } else {
      await app.debts.addPerson({ name, phone: phone || null, note: note || null });
    }
    closeAllModals();
    toast("تم الحفظ ✓", "success");
    await renderPersons();
  } catch (e) {
    toast(e.message || "فشل الحفظ", "error");
  }
}
const CAT_ICONS = [
  "🛒",
  "🚗",
  "🍔",
  "🏠",
  "💡",
  "📱",
  "👗",
  "🎮",
  "✈️",
  "💊",
  "📚",
  "🎁",
  "🏋️",
  "☕",
  "🎬",
  "🐾",
  "🧴",
  "🔧",
  "🍕",
  "🌿",
  "💈",
  "🧸",
  "⚽",
  "🎵",
  "🏥",
  "🚌",
  "💰",
  "💳",
  "🏦",
  "📦",
  "🧹",
  "🪴",
  "🎓",
  "👶",
  "🎨",
  "🍺",
  "🛍️",
  "🚿",
  "🧺",
  "⚡",
  "🌊",
  "🏔️",
  "🍰",
  "🎪",
  "🔑",
  "📸",
  "🧪",
  "🛒"
];
const CAT_COLORS = ["#818cf8", "#f87171", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6", "#2dd4bf", "#fb923c", "#a3e635"];
async function renderBudget() {
  await waitForApp();
  const bm = await app.budget.getOrCreateMonth(currentMonth);
  const cats = await app.budget.getCategories(currentMonth);
  const sum = await app.budget.getMonthSummary(currentMonth);
  const d = /* @__PURE__ */ new Date(currentMonth + "-01");
  document.getElementById("budget-month-lbl").textContent = d.toLocaleDateString("en-US", { month: "long", year: "numeric" }).replace(/(\w+)\s(\d+)/, (_, m, y) => {
    const AR = { January: "يناير", February: "فبراير", March: "مارس", April: "أبريل", May: "مايو", June: "يونيو", July: "يوليو", August: "أغسطس", September: "سبتمبر", October: "أكتوبر", November: "نوفمبر", December: "ديسمبر" };
    return (AR[m] || m) + " " + y;
  });
  document.getElementById("budget-income-lbl").textContent = bm.income ? fmt(bm.income, currency) : "لم يُحدَّد";
  const remaining = (sum == null ? void 0 : sum.remaining) ?? bm.income ?? 0;
  const remEl = document.getElementById("budget-remaining-lbl");
  remEl.textContent = fmt(remaining, currency);
  remEl.style.color = remaining < 0 ? "#fca5a5" : "#6ee7b7";
  document.getElementById("budget-pct-lbl").textContent = bm.income ? `${(sum == null ? void 0 : sum.spentPct) ?? 0}% مُنفَق` : "";
  const seg = document.getElementById("budget-seg-bar");
  const leg = document.getElementById("budget-legend");
  seg.innerHTML = "";
  leg.innerHTML = "";
  const totalIncome = bm.income || 1;
  cats.forEach((c, i) => {
    const color = c.color || CAT_COLORS[i % CAT_COLORS.length];
    const pct = Math.min(100, c.spent / totalIncome * 100);
    if (pct > 0.3) {
      const piece = document.createElement("div");
      piece.className = "seg-piece";
      piece.style.flex = pct;
      piece.style.background = color;
      seg.appendChild(piece);
    }
    if (c.spent > 0 || c.budget_cap > 0) {
      const li = document.createElement("div");
      li.className = "legend-item";
      li.innerHTML = `<div class="legend-dot" style="background:${color}"></div>${c.icon || "📦"} ${c.name}`;
      leg.appendChild(li);
    }
  });
  const remPct = Math.max(0, 100 - ((sum == null ? void 0 : sum.spentPct) ?? 0));
  if (remPct > 0.3) {
    const p = document.createElement("div");
    p.className = "seg-piece";
    p.style.flex = remPct;
    p.style.background = "rgba(255,255,255,.12)";
    seg.appendChild(p);
  }
  const sug = await app.budget.getSuggestion(currentMonth);
  const sugEl = document.getElementById("budget-suggestion");
  if (sug && sug.type === "pay_debt") {
    sugEl.innerHTML = `
        <div class="suggestion-card">
          <div class="sug-icon"><i class="fa-solid fa-lightbulb"></i></div>
          <div>
            <div class="sug-title">فائض: ${fmt(sug.remaining, currency)}</div>
            <div class="sug-body">اقتراح: سدّد ${fmt(sug.amount, sug.debt.currency || currency)} على "${sug.debt.title}" — ${sug.debt.person_name}</div>
          </div>
        </div>`;
  } else if (sug && sug.type === "collect_debt") {
    sugEl.innerHTML = `
        <div class="suggestion-card" style="border-color:#f59e0b;">
          <div class="sug-icon" style="color:#f59e0b;background:rgba(245,158,11,.15);"><i class="fa-solid fa-bell"></i></div>
          <div>
            <div class="sug-title" style="color:#f59e0b;">فائض: ${fmt(sug.remaining, currency)}</div>
            <div class="sug-body">تذكير: حصّل ${fmt(sug.amount, sug.debt.currency || currency)} من "${sug.debt.title}" — ${sug.debt.person_name}</div>
          </div>
        </div>`;
  } else {
    sugEl.innerHTML = "";
  }
  const cc = document.getElementById("cats-container");
  cc.innerHTML = "";
  if (!cats.length) {
    cc.innerHTML = `<div class="empty-state"><i class="fa-solid fa-wallet"></i><p>لا توجد فئات بعد</p><p style="font-size:.78rem;margin-top:8px;">اضغط + لإضافة فئة مصروف</p></div>`;
    return;
  }
  const today = (/* @__PURE__ */ new Date()).getDate();
  cats.forEach((c, i) => {
    const color = c.color || CAT_COLORS[i % CAT_COLORS.length];
    const icon = c.icon || CAT_ICONS[i % CAT_ICONS.length];
    const overBudget = c.budget_cap > 0 && c.spent > c.budget_cap;
    const pct = Math.min(100, c.usage_pct ?? 0);
    const dueDay = c.due_day ? parseInt(c.due_day) : null;
    const overDue = dueDay && today > dueDay + 1;
    const el = document.createElement("div");
    el.className = "cat-card fade-up";
    el.style.animationDelay = `${i * 0.04}s`;
    el.innerHTML = `
        <div class="cat-top">
          <div class="cat-icon" style="background:${color}20;font-size:18px;">${icon}</div>
          <div class="cat-name">${c.name}</div>
          <button class="__cat-add-exp bcard"
            style="padding:6px 10px;font-size:.72rem;background:${color}15;color:${color};border:1px solid ${color}40;">
            <i class="fa-solid fa-plus"></i> مصروف
          </button>
          <button class="__cat-edit"
            style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 9px;color:var(--text-3);cursor:pointer;font-size:.8rem;flex-shrink:0;"
            title="تعديل الفئة">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </div>
        <div class="cat-nums">
          <span>المُنفَق: <strong>${fmt(c.spent, currency)}</strong></span>
          <span style="color:${overBudget ? "#f87171" : color};">${c.budget_cap > 0 ? fmt(c.budget_cap, currency) + " حد" : "بلا حد"} · ${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%;background:${overBudget ? "#f87171" : color};transition:width .5s;"></div>
        </div>
        ${c.linked_type === "debt_payments" ? `<div class="linked-tag"><i class="fa-solid fa-link"></i> مرتبط بالديون</div>` : ""}
        ${dueDay ? `<div class="due-badge ${overDue ? "overdue" : "upcoming"}">
          <i class="fa-solid fa-clock"></i>
          ${overDue ? "تجاوز يوم " + dueDay : "يستحق يوم " + dueDay}
        </div>` : ""}
        <div id="expenses-${c.id}" style="margin-top:8px;display:none;"></div>`;
    el.querySelector(".__cat-add-exp").addEventListener("click", (ev) => {
      ev.stopPropagation();
      openAddExpenseModal(c.id, c.name, icon);
    });
    el.querySelector(".__cat-edit").addEventListener("click", (ev) => {
      ev.stopPropagation();
      openEditCatModal(c);
    });
    el.addEventListener("click", () => toggleCatExpenses(c.id));
    cc.appendChild(el);
  });
}
async function toggleCatExpenses(catId) {
  const div = document.getElementById(`expenses-${catId}`);
  if (!div) return;
  if (div.style.display === "block") {
    div.style.display = "none";
    return;
  }
  await loadCatExpenses(catId);
}
async function loadCatExpenses(catId) {
  const div = document.getElementById(`expenses-${catId}`);
  if (!div) return;
  div.style.display = "block";
  div.innerHTML = `<div style="font-size:.72rem;color:var(--text-3);text-align:center;padding:6px;">جاري التحميل...</div>`;
  try {
    const expenses = await app.budget.getExpenses(catId);
    if (!expenses.length) {
      div.innerHTML = `<div style="font-size:.72rem;color:var(--text-3);text-align:center;padding:10px 0;border-top:1px dashed var(--border);">لا توجد مصاريف مسجلة بعد</div>`;
      return;
    }
    div.innerHTML = "";
    const hdr = document.createElement("div");
    hdr.style.cssText = "font-size:.68rem;font-weight:700;color:var(--text-3);padding:6px 0 4px;border-top:1px dashed var(--border);";
    hdr.textContent = `آخر ${expenses.length} مصاريف`;
    div.appendChild(hdr);
    expenses.forEach((e) => {
      const row = document.createElement("div");
      row.className = "expense-item";
      row.innerHTML = `
          <span class="expense-amt">-${fmt(e.amount, currency)}</span>
          <span class="expense-note">${e.note || "—"}</span>
          <span class="expense-date">${e.expense_date || ""}</span>
          <button data-eid="${e.id}" data-cid="${catId}" class="__exp-edit"
            style="background:none;border:none;color:var(--text-3);cursor:pointer;padding:2px 5px;font-size:.8rem;" title="تعديل">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>`;
      row.querySelector(".__exp-edit").addEventListener("click", (ev) => {
        ev.stopPropagation();
        openEditExpenseModal(e, catId);
      });
      div.appendChild(row);
    });
  } catch (err) {
    div.innerHTML = `<div style="font-size:.72rem;color:#f87171;text-align:center;padding:4px;">خطأ في التحميل</div>`;
  }
}
let editExpenseId = null;
let editExpenseCatId = null;
function openEditExpenseModal(e, catId) {
  editExpenseId = e.id;
  editExpenseCatId = catId;
  document.getElementById("expense-cat-name").textContent = "تعديل المصروف";
  document.getElementById("expense-amount-inp").value = e.amount;
  document.getElementById("expense-note-inp").value = e.note || "";
  document.getElementById("expense-date-inp").value = e.expense_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  document.getElementById("expense-save-btn").onclick = saveEditExpense;
  let delBtn = document.getElementById("expense-del-btn");
  if (!delBtn) {
    delBtn = document.createElement("button");
    delBtn.id = "expense-del-btn";
    delBtn.className = "mbtn mbtn-del";
    delBtn.textContent = "حذف";
    document.querySelector("#expense-modal .modal-btns").insertBefore(
      delBtn,
      document.getElementById("expense-save-btn")
    );
  }
  delBtn.style.display = "";
  delBtn.onclick = deleteExpense;
  openModal("expense-modal");
}
async function saveEditExpense() {
  await waitForApp();
  const amount = +document.getElementById("expense-amount-inp").value;
  const note = document.getElementById("expense-note-inp").value.trim();
  const date = document.getElementById("expense-date-inp").value;
  if (!amount || amount <= 0) {
    toast("أدخل المبلغ", "error");
    return;
  }
  await app.db.run(
    `UPDATE budget_expenses SET amount=?,note=?,expense_date=? WHERE id=?`,
    [amount, note || null, date, editExpenseId]
  );
  closeAllModals();
  toast("تم التعديل ✓", "success");
  await renderBudget();
  await loadCatExpenses(editExpenseCatId);
}
async function deleteExpense() {
  if (window._GtSecure && !await window._GtSecure.requirePwd("delete", "حذف المصروف")) return;
  await waitForApp();
  const exp = (await app.db.query(`SELECT * FROM budget_expenses WHERE id=?`, [editExpenseId]))[0];
  await app.budget.deleteExpense(editExpenseId);
  closeAllModals();
  await renderBudget();
  const undid = await toastUndo(`تم حذف مصروف ${fmt((exp == null ? void 0 : exp.amount) || 0, currency)}`, 5e3);
  if (undid && exp) {
    await app.db.run(
      `INSERT INTO budget_expenses (id,category_id,month_id,amount,note,expense_date,payment_id,created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [exp.id, exp.category_id, exp.month_id, exp.amount, exp.note, exp.expense_date, exp.payment_id, exp.created_at]
    );
    toast("تم الاستعادة ✓", "success");
    await renderBudget();
  }
}
window.openAddExpenseModal = function(catId, catName, icon) {
  editExpenseId = null;
  editExpenseCatId = catId;
  document.getElementById("expense-cat-name").textContent = `${icon} ${catName}`;
  document.getElementById("expense-amount-inp").value = "";
  document.getElementById("expense-note-inp").value = "";
  document.getElementById("expense-date-inp").value = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  document.getElementById("expense-save-btn").onclick = () => saveExpense(catId);
  const delBtn = document.getElementById("expense-del-btn");
  if (delBtn) delBtn.style.display = "none";
  openModal("expense-modal");
};
async function saveExpense(catId) {
  await waitForApp();
  const amount = +document.getElementById("expense-amount-inp").value;
  const note = document.getElementById("expense-note-inp").value.trim();
  const date = document.getElementById("expense-date-inp").value || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (!amount || amount <= 0) {
    toast("أدخل المبلغ", "error");
    return;
  }
  const month = date.slice(0, 7);
  const bm = await app.budget.getOrCreateMonth(month);
  await app.budget.addExpense(catId, { amount, note: note || null, expenseDate: date, monthId: bm.id });
  closeAllModals();
  toast(`تم تسجيل ${fmt(amount, currency)} ✓`, "success");
  if (month === currentMonth) await renderBudget();
}
function buildIconGrid(selectedIcon) {
  const grid = document.getElementById("cat-icon-grid");
  grid.innerHTML = "";
  CAT_ICONS.forEach((icon) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn" + (icon === selectedIcon ? " selected" : "");
    btn.textContent = icon;
    btn.onclick = () => {
      document.querySelectorAll("#cat-icon-grid .icon-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      document.getElementById("cat-icon-inp").value = icon;
      document.getElementById("cat-modal-ico").textContent = icon;
    };
    grid.appendChild(btn);
  });
  document.getElementById("cat-icon-inp").value = selectedIcon;
}
window.changeMonth = async function(delta) {
  const d = /* @__PURE__ */ new Date(currentMonth + "-01");
  d.setMonth(d.getMonth() + delta);
  currentMonth = d.toISOString().slice(0, 7);
  await renderBudget();
};
window.goToCurrentMonth = async function() {
  currentMonth = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  await renderBudget();
};
window.promptIncome = async function() {
  await waitForApp();
  const bm = await app.budget.getOrCreateMonth(currentMonth);
  const inp = document.getElementById("income-inp");
  if (inp) inp.value = bm.income || "";
  openModal("income-modal");
  setTimeout(() => {
    var _a;
    return (_a = document.getElementById("income-inp")) == null ? void 0 : _a.focus();
  }, 100);
};
window.saveIncome = async function() {
  const v = +document.getElementById("income-inp").value;
  if (!isNaN(v) && v >= 0) {
    await app.budget.setIncome(currentMonth, v);
    closeAllModals();
    await renderBudget();
  } else {
    toast("أدخل رقماً صحيحاً", "error");
  }
};
window.openAddCatModal = function() {
  editCatId = null;
  document.getElementById("cat-modal-title").textContent = "فئة جديدة";
  document.getElementById("cat-name-inp").value = "";
  document.getElementById("cat-cap-inp").value = "";
  document.getElementById("cat-due-day-inp").value = "";
  document.getElementById("cat-linked-cb").checked = false;
  document.getElementById("cat-del-btn").style.display = "none";
  buildIconGrid("💰");
  document.getElementById("cat-modal-ico").textContent = "💰";
  document.getElementById("cat-save-btn").onclick = saveCat;
  openModal("cat-modal");
};
function openEditCatModal(c) {
  editCatId = c.id;
  document.getElementById("cat-modal-title").textContent = "تعديل الفئة";
  document.getElementById("cat-name-inp").value = c.name;
  document.getElementById("cat-cap-inp").value = c.budget_cap || "";
  document.getElementById("cat-due-day-inp").value = c.due_day || "";
  document.getElementById("cat-linked-cb").checked = c.linked_type === "debt_payments";
  document.getElementById("cat-del-btn").style.display = "";
  const icon = c.icon || "💰";
  buildIconGrid(icon);
  document.getElementById("cat-modal-ico").textContent = icon;
  document.getElementById("cat-save-btn").onclick = saveCat;
  openModal("cat-modal");
}
async function saveCat() {
  await waitForApp();
  const name = document.getElementById("cat-name-inp").value.trim();
  const cap = +document.getElementById("cat-cap-inp").value || 0;
  const dueDay = +document.getElementById("cat-due-day-inp").value || null;
  const linked = document.getElementById("cat-linked-cb").checked ? "debt_payments" : null;
  const icon = document.getElementById("cat-icon-inp").value || "💰";
  if (!name) {
    toast("أدخل اسم الفئة", "error");
    return;
  }
  if (editCatId) {
    await app.budget.updateCategory(editCatId, {
      name,
      budget_cap: cap,
      icon,
      due_day: dueDay,
      linked_type: linked
    });
  } else {
    await app.budget.addCategory(currentMonth, { name, icon, budgetCap: cap, linkedType: linked, dueDay });
    const bm = await app.budget.getMonth(currentMonth);
    if (!(bm == null ? void 0 : bm.income)) promptIncome();
  }
  closeAllModals();
  toast("تم الحفظ", "success");
  await renderBudget();
}
window.deleteCat = async function() {
  if (!editCatId) return;
  if (window._GtSecure && !await window._GtSecure.requirePwd("delete", "حذف فئة الميزانية")) return;
  await waitForApp();
  const cats = await app.budget.getCategories(currentMonth);
  const cat = cats.find((c) => c.id === editCatId);
  const expenses = await app.budget.getExpenses(editCatId);
  await app.budget.deleteCategory(editCatId);
  closeAllModals();
  await renderBudget();
  const undid = await toastUndo(`تم حذف فئة "${cat == null ? void 0 : cat.name}"`, 5e3);
  if (undid) {
    const bm = await app.budget.getOrCreateMonth(currentMonth);
    await app.db.run(
      `INSERT INTO budget_categories (id,month_id,name,icon,color,budget_cap,due_day,sort_order,linked_type) VALUES (?,?,?,?,?,?,?,?,?)`,
      [cat.id, bm.id, cat.name, cat.icon, cat.color, cat.budget_cap, cat.due_day, cat.sort_order, cat.linked_type]
    );
    for (const e of expenses) {
      await app.db.run(
        `INSERT INTO budget_expenses (id,category_id,month_id,amount,note,expense_date,payment_id,created_at) VALUES (?,?,?,?,?,?,?,?)`,
        [e.id, e.category_id, e.month_id, e.amount, e.note, e.expense_date, e.payment_id, e.created_at]
      );
    }
    toast("تم الاستعادة ✓", "success");
    await renderBudget();
  }
};
async function renderSettings() {
  var _a, _b;
  await waitForApp();
  const sync = await app.db.query(`SELECT * FROM drive_sync WHERE id=1`);
  const s = sync[0] ?? {};
  const dot = document.getElementById("drive-dot");
  const lbl = document.getElementById("drive-status-lbl");
  const isConnected = ((_b = (_a = app.drive) == null ? void 0 : _a.isSignedIn) == null ? void 0 : _b.call(_a)) ?? false;
  dot.className = `drive-dot ${isConnected ? "connected" : "idle"}`;
  lbl.textContent = isConnected ? "متصل" : "غير متصل";
  document.getElementById("btn-drive-upload").style.display = isConnected ? "" : "none";
  document.getElementById("btn-drive-download").style.display = isConnected ? "" : "none";
  if (s.last_synced) {
    document.getElementById("last-sync-lbl").textContent = formatDateLatin(s.last_synced);
  }
}
window.handleDriveAction = async function() {
  var _a, _b;
  await waitForApp();
  if ((_b = (_a = app.drive) == null ? void 0 : _a.isSignedIn) == null ? void 0 : _b.call(_a)) {
    if (await confirm("تسجيل الخروج من Google Drive؟")) {
      app.drive.signOut();
      await renderSettings();
      updateDropdownStatus();
    }
  } else {
    try {
      await app.drive.signIn();
      toast("تم الاتصال بـ Google Drive ✓", "success");
      await renderSettings();
      updateDropdownStatus();
    } catch (e) {
      toast("فشل الاتصال: " + e.message, "error");
    }
  }
};
window.uploadDrive = async function() {
  await waitForApp();
  try {
    document.getElementById("drive-dot").className = "drive-dot syncing";
    await app.drive.upload();
    toast("تم الرفع بنجاح ✓", "success");
    await renderSettings();
  } catch (e) {
    toast("خطأ في الرفع: " + e.message, "error");
  }
};
window.downloadDrive = async function() {
  await waitForApp();
  if (!await confirm("سيُعيد كتابة البيانات المحلية كاملاً. هل تريد المتابعة؟")) return;
  try {
    await app.drive.download();
    toast("تم الاستعادة ✓", "success");
    await renderCurrentPage();
  } catch (e) {
    toast("خطأ في التنزيل: " + e.message, "error");
  }
};
window.exportJSON = async function() {
  await waitForApp();
  const [
    persons,
    debts,
    payments,
    scheduled,
    budget,
    categories,
    expenses,
    settings
  ] = await Promise.all([
    app.db.query("SELECT * FROM persons"),
    app.db.query("SELECT * FROM debts"),
    app.db.query("SELECT * FROM payments"),
    app.db.query("SELECT * FROM scheduled_payments"),
    app.db.query("SELECT * FROM budget_months"),
    app.db.query("SELECT * FROM budget_categories"),
    app.db.query("SELECT * FROM budget_expenses"),
    app.db.query("SELECT * FROM settings")
  ]);
  const payload = JSON.stringify({
    version: "1.0.2",
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    persons,
    debts,
    payments,
    scheduled,
    budget,
    categories,
    expenses,
    settings
  }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gt-dayn-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3e3);
  toast("تم التصدير الكامل ✓", "success");
};
window.exportSQLite = async function() {
  await waitForApp();
  const data = await app.db.export();
  const blob = new Blob([data], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gt-dayn-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.sqlite`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3e3);
  toast("تم التصدير ✓", "success");
};
window.importJSON = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await waitForApp();
    const text = await file.text();
    const data = JSON.parse(text);
    toast("جاري الاستيراد الكامل...", "info");
    for (const p of data.persons ?? []) {
      await app.db.run(
        `INSERT OR REPLACE INTO persons (id,name,avatar,phone,note,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?)`,
        [p.id, p.name, p.avatar, p.phone, p.note, p.created_at, p.updated_at]
      );
    }
    for (const d of data.debts ?? []) {
      await app.db.run(
        `INSERT OR REPLACE INTO debts (id,person_id,type,title,amount,remaining,note,status,sort_order,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [d.id, d.person_id, d.type, d.title, d.amount, d.remaining, d.note, d.status, d.sort_order, d.created_at, d.updated_at]
      );
    }
    for (const p of data.payments ?? []) {
      await app.db.run(
        `INSERT OR REPLACE INTO payments (id,debt_id,amount,note,paid_at,created_at)
           VALUES (?,?,?,?,?,?)`,
        [p.id, p.debt_id, p.amount, p.note, p.paid_at, p.created_at]
      );
    }
    for (const s of data.scheduled ?? []) {
      await app.db.run(
        `INSERT OR REPLACE INTO scheduled_payments (id,debt_id,amount,due_date,status,created_at)
           VALUES (?,?,?,?,?,?)`,
        [s.id, s.debt_id, s.amount, s.due_date, s.status, s.created_at]
      );
    }
    for (const bm of data.budget ?? []) {
      await app.db.run(
        `INSERT OR REPLACE INTO budget_months (id,month,income,spent,note,created_at)
           VALUES (?,?,?,?,?,?)`,
        [bm.id, bm.month, bm.income, bm.spent, bm.note, bm.created_at]
      );
    }
    for (const c of data.categories ?? []) {
      await app.db.run(
        `INSERT OR REPLACE INTO budget_categories (id,month_id,name,icon,color,budget_cap,due_day,sort_order,linked_type)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        [c.id, c.month_id, c.name, c.icon, c.color, c.budget_cap, c.due_day, c.sort_order, c.linked_type]
      );
    }
    for (const ex of data.expenses ?? []) {
      await app.db.run(
        `INSERT OR REPLACE INTO budget_expenses (id,category_id,month_id,amount,note,expense_date,payment_id,created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
        [ex.id, ex.category_id, ex.month_id, ex.amount, ex.note, ex.expense_date, ex.payment_id, ex.created_at]
      );
    }
    for (const s of data.settings ?? []) {
      await app.db.run(
        `INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)`,
        [s.key, s.value]
      );
      if (s.key === "currency_sym") {
        currency = s.value;
      }
      if (s.key === "theme") applyTheme(s.value);
    }
    document.getElementById("currency-lbl").textContent = currency;
    document.getElementById("dropdown-currency").textContent = currency;
    updateThemeToggle();
    toast("تم الاستيراد الكامل ✓", "success");
    await renderCurrentPage();
  } catch (err) {
    toast("خطأ في الاستيراد: " + err.message, "error");
  }
  e.target.value = "";
};
window.confirmReset = async function() {
  await waitForApp();
  if (window._GtSecure && !await window._GtSecure.requirePwd("delete", "حذف كل البيانات")) return;
  if (!await confirm("سيُحذف كل شيء نهائياً — الديون والأشخاص والميزانية كاملاً. هل أنت متأكد؟")) return;
  if (!await confirm("⚠️ لا يمكن التراجع عن هذه العملية. تأكيد نهائي؟")) return;
  await app.db.run("DELETE FROM budget_expenses");
  await app.db.run("DELETE FROM budget_categories");
  await app.db.run("DELETE FROM budget_months");
  await app.db.run("DELETE FROM scheduled_payments");
  await app.db.run("DELETE FROM payments");
  await app.db.run("DELETE FROM debts");
  await app.db.run("DELETE FROM persons");
  localStorage.removeItem("gt-dayn-backup");
  toast("تم حذف كل البيانات", "error");
  await renderCurrentPage();
};
function detectSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applySavedOrSystemTheme(savedTheme) {
  if (savedTheme === "auto") {
    const systemTheme = detectSystemTheme();
    applyTheme("auto");
    document.documentElement.setAttribute("data-system-theme", systemTheme);
  } else {
    applyTheme(savedTheme || "light");
  }
}
window.toggleTheme = async function() {
  await waitForApp();
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  let newTheme;
  if (currentTheme === "light") newTheme = "dark";
  else if (currentTheme === "dark") newTheme = "auto";
  else newTheme = "light";
  applySavedOrSystemTheme(newTheme);
  await app.db.run(`UPDATE settings SET value=? WHERE key='theme'`, [newTheme]);
  updateThemeToggle();
  updateDropdownStatus();
  if (typeof _gtUpdateLockUI === "function") _gtUpdateLockUI();
};
function updateThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const themeLabels = { light: "فاتح", dark: "داكن", auto: "تلقائي" };
  const themeIcons = { light: "☀️", dark: "🌙", auto: "🌓" };
  toggle.classList.remove("on");
  if (currentTheme === "dark") {
    toggle.classList.add("on");
  }
  toggle.setAttribute("aria-checked", currentTheme !== "light" ? "true" : "false");
  const themeText = document.getElementById("theme-text");
  if (themeText) {
    themeText.textContent = `الوضع: ${themeLabels[currentTheme] || "فاتح"} ${themeIcons[currentTheme] || "☀️"}`;
  }
}
if (window.matchMedia) {
  const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  darkModeQuery.addEventListener("change", (e) => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    if (currentTheme === "auto") {
      document.documentElement.setAttribute("data-system-theme", e.matches ? "dark" : "light");
    }
  });
}
async function renderStatistics() {
  await waitForApp();
  const debts = await app.debts.getDebts({});
  const summary = await app.debts.getSummary();
  const totalDebt = summary.totalReceivable + summary.totalPayable;
  const activeDebts = debts.filter((d) => d.status !== "done").length;
  const totalPaid = debts.reduce((acc, d) => acc + (d.amount - d.remaining), 0);
  const totalRemaining = debts.reduce((acc, d) => acc + d.remaining, 0);
  document.getElementById("stat-total-debt").textContent = fmt(totalDebt, currency);
  document.getElementById("stat-active-debts").textContent = activeDebts;
  document.getElementById("stat-paid").textContent = fmt(totalPaid, currency);
  document.getElementById("stat-remaining").textContent = fmt(totalRemaining, currency);
  const monthlyPayment = 500;
  const monthsToFree = Math.ceil(totalRemaining / monthlyPayment);
  const freeDate = /* @__PURE__ */ new Date();
  freeDate.setMonth(freeDate.getMonth() + monthsToFree);
  document.getElementById("debt-free-date").textContent = freeDate.toLocaleDateString("ar-EG-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
  const ctx = document.getElementById("debtChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["لي عند", "عليّ"],
      datasets: [{
        data: [summary.totalReceivable, summary.totalPayable],
        backgroundColor: ["#818cf8", "#f87171"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}
window.applySnowballStrategy = async function() {
  await waitForApp();
  const debts = await app.debts.getDebts({});
  const payableDebts = debts.filter((d) => d.type === "payable" && d.status !== "done").sort((a, b) => a.remaining - b.remaining);
  if (payableDebts.length) {
    toast(`🔹 استراتيجية كرة الثلج: ابدأ بسداد "${payableDebts[0].title}"`, "info", 3e3);
  } else {
    toast("لا توجد ديون مستحقة", "info");
  }
};
window.applyPriorityStrategy = async function() {
  await waitForApp();
  const debts = await app.debts.getDebts({});
  const payableDebts = debts.filter((d) => d.type === "payable" && d.status !== "done").sort((a, b) => b.remaining - a.remaining);
  if (payableDebts.length) {
    toast(`⭐ سياسة تسديد الديون ذات الأولوية: ركز على "${payableDebts[0].title}"`, "info", 3e3);
  } else {
    toast("لا توجد ديون مستحقة", "info");
  }
};
window.closeAllModals = function() {
  document.querySelectorAll(".modal-overlay.active:not(#confirm-modal-overlay)").forEach((m) => m.classList.remove("active"));
  document.getElementById("settings-dropdown").classList.remove("active");
};
window.confirm = async function(msg) {
  return new Promise((res) => {
    document.getElementById("confirm-msg").textContent = msg;
    document.getElementById("confirm-modal-overlay").classList.add("active");
    const ok = document.getElementById("confirm-ok");
    const cxl = document.getElementById("confirm-cancel");
    const cleanup = (val) => {
      document.getElementById("confirm-modal-overlay").classList.remove("active");
      ok.onclick = null;
      cxl.onclick = null;
      res(val);
    };
    ok.onclick = () => cleanup(true);
    cxl.onclick = () => cleanup(false);
  });
};
window.openMenu = function() {
  document.getElementById("settings-dropdown").classList.toggle("active");
  updateDropdownStatus();
};
window.quickAction = async function(action) {
  document.getElementById("settings-dropdown").classList.remove("active");
  if (action === "drive") handleDriveAction();
  else if (action === "currency") openCurrencyModal();
  else if (action === "theme") toggleTheme();
  else if (action === "calc") openCalc(null);
  else if (action === "export") exportJSON();
  else if (action === "import") document.getElementById("import-input").click();
  else if (action === "stats") navigateTo("statistics");
  else if (action === "reset") confirmReset();
  else if (action === "backup-json") window.backupDownload("json");
  else if (action === "backup-sqlite") window.backupDownload("sqlite");
  else if (action === "share-json") window.backupShare("json");
  else if (action === "share-sqlite") window.backupShare("sqlite");
};
window.updateThemeToggle = updateThemeToggle;
window.renderPersons = renderPersons;
window.renderBudget = renderBudget;
window.renderSettings = renderSettings;
window.toggleTheme = toggleTheme;
window.handleDriveAction = handleDriveAction;
window.exportJSON = exportJSON;
window.uploadDrive = uploadDrive;
window.downloadDrive = downloadDrive;
window.exportSQLite = exportSQLite;
window.importJSON = importJSON;
window.confirmReset = confirmReset;
window.applySnowballStrategy = applySnowballStrategy;
window.applyPriorityStrategy = applyPriorityStrategy;
const CURRENCIES = [
  { code: "MAD", sym: "د.م", name: "درهم مغربي", flag: "🇲🇦" },
  { code: "DZD", sym: "د.ج", name: "دينار جزائري", flag: "🇩🇿" },
  { code: "TND", sym: "د.ت", name: "دينار تونسي", flag: "🇹🇳" },
  { code: "LYD", sym: "د.ل", name: "دينار ليبي", flag: "🇱🇾" },
  { code: "MRU", sym: "أ.م", name: "أوقية موريتانية", flag: "🇲🇷" },
  { code: "EGP", sym: "ج.م", name: "جنيه مصري", flag: "🇪🇬" },
  { code: "SDG", sym: "ج.س", name: "جنيه سوداني", flag: "🇸🇩" },
  { code: "SOS", sym: "ش.ص", name: "شلن صومالي", flag: "🇸🇴" },
  { code: "DJF", sym: "ف.ج", name: "فرنك جيبوتي", flag: "🇩🇯" },
  { code: "KMF", sym: "ف.ق", name: "فرنك جزر القمر", flag: "🇰🇲" },
  { code: "JOD", sym: "د.ا", name: "دينار أردني", flag: "🇯🇴" },
  { code: "SYP", sym: "ل.س", name: "ليرة سورية", flag: "🇸🇾" },
  { code: "LBP", sym: "ل.ل", name: "ليرة لبنانية", flag: "🇱🇧" },
  { code: "IQD", sym: "ع.د", name: "دينار عراقي", flag: "🇮🇶" },
  { code: "PSE", sym: "₪", name: "شيكل (فلسطين)", flag: "🇵🇸" },
  { code: "SAR", sym: "ر.س", name: "ريال سعودي", flag: "🇸🇦" },
  { code: "AED", sym: "د.إ", name: "درهم إماراتي", flag: "🇦🇪" },
  { code: "KWD", sym: "د.ك", name: "دينار كويتي", flag: "🇰🇼" },
  { code: "QAR", sym: "ر.ق", name: "ريال قطري", flag: "🇶🇦" },
  { code: "BHD", sym: "د.ب", name: "دينار بحريني", flag: "🇧🇭" },
  { code: "OMR", sym: "ر.ع", name: "ريال عماني", flag: "🇴🇲" },
  { code: "YER", sym: "ر.ي", name: "ريال يمني", flag: "🇾🇪" },
  { code: "USD", sym: "$", name: "دولار أمريكي", flag: "🇺🇸" },
  { code: "EUR", sym: "€", name: "يورو", flag: "🇪🇺" },
  { code: "GBP", sym: "£", name: "جنيه إسترليني", flag: "🇬🇧" },
  { code: "TRY", sym: "₺", name: "ليرة تركية", flag: "🇹🇷" },
  { code: "CNY", sym: "¥", name: "يوان صيني", flag: "🇨🇳" }
];
window.openCurrencyModal = function() {
  const list = document.getElementById("currency-list");
  list.innerHTML = "";
  CURRENCIES.forEach((c) => {
    const item = document.createElement("div");
    item.className = "currency-item" + (c.sym === currency ? " selected" : "");
    if (c.sym === currency) item.style.cssText = "border-color:var(--primary-mid);background:rgba(129,140,248,.08);";
    item.innerHTML = `
        <span class="currency-flag">${c.flag}</span>
        <span class="currency-name">${c.name}</span>
        <span class="currency-symbol">${c.sym}</span>
        ${c.sym === currency ? '<i class="fa-solid fa-check" style="color:var(--primary-mid);margin-right:auto;"></i>' : ""}`;
    item.onclick = async () => {
      await waitForApp();
      currency = c.sym;
      await app.db.run(`UPDATE settings SET value=? WHERE key='currency'`, [c.code]);
      await app.db.run(`UPDATE settings SET value=? WHERE key='currency_sym'`, [c.sym]);
      document.getElementById("currency-lbl").textContent = `${c.sym} (${c.code})`;
      document.getElementById("dropdown-currency").textContent = c.sym;
      closeAllModals();
      toast(`العملة: ${c.name} (${c.sym})`, "success");
      await saveDataToStorage();
      await renderCurrentPage();
    };
    list.appendChild(item);
  });
  openModal("currency-modal");
};
window._profilePersonId = null;
let _profileDebtFilter = "all";
function openPersonProfile(p) {
  var _a;
  window._profilePersonId = p.id;
  _profileDebtFilter = "all";
  const [bg, fg] = avatarColor(p.name);
  const av = document.getElementById("profile-avatar");
  av.style.cssText = `width:44px;height:44px;border-radius:14px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:900;flex-shrink:0;`;
  av.textContent = initial(p.name);
  document.getElementById("profile-name").textContent = p.name;
  const phoneRow = document.getElementById("profile-phone-row");
  if (p.phone) {
    phoneRow.style.display = "flex";
    document.getElementById("profile-phone-lbl").textContent = p.phone;
    document.getElementById("profile-copy-phone").onclick = () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(p.phone).then(() => toast("تم نسخ الرقم ✓", "success"));
      } else {
        const ta = document.createElement("textarea");
        ta.value = p.phone;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("تم نسخ الرقم ✓", "success");
      }
    };
  } else {
    phoneRow.style.display = "none";
  }
  const net = p.net_balance || 0;
  document.getElementById("profile-receivable").textContent = fmt(p.receivable_total || 0, currency);
  document.getElementById("profile-payable").textContent = fmt(p.payable_total || 0, currency);
  const netEl = document.getElementById("profile-net");
  netEl.textContent = (net >= 0 ? "+" : "") + fmt(net, currency);
  netEl.style.color = net >= 0 ? "#6ee7b7" : "#fca5a5";
  document.querySelectorAll("#profile-tabs .tab-btn").forEach((b, i) => b.classList.toggle("active", i === 0));
  document.querySelectorAll(".page").forEach((pg) => pg.style.display = "none");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById("page-person-profile").style.display = "";
  (_a = document.getElementById("nav-persons")) == null ? void 0 : _a.classList.add("active");
  currentPage = "person-profile";
  renderProfileDebts();
}
async function renderProfileDebts() {
  if (!window._profilePersonId) return;
  await waitForApp();
  const opts = { personId: window._profilePersonId };
  if (_profileDebtFilter !== "all") opts.type = _profileDebtFilter;
  const debts = await app.debts.getDebts(opts);
  renderDebtCards(debts, document.getElementById("profile-debts-container"));
}
window.setProfileTab = function(filter, btn) {
  _profileDebtFilter = filter;
  document.querySelectorAll("#profile-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderProfileDebts();
};
window.backToPersons = async function() {
  window._profilePersonId = null;
  await navigateTo("persons");
};
window.sharePersonReport = async function() {
  var _a;
  await waitForApp();
  if (!window._profilePersonId) return;
  const persons = await app.debts.getPersons();
  const p = persons.find((x) => x.id === window._profilePersonId);
  if (!p) return;
  const debts = await app.debts.getDebts({ personId: window._profilePersonId });
  if (!debts.length) {
    toast("لا توجد ديون لهذا الشخص", "info");
    return;
  }
  const net = p.net_balance || 0;
  const fakeDebt = {
    person_id: p.id,
    type: net >= 0 ? "receivable" : "payable",
    title: `ملخص ${p.name}`,
    amount: Math.abs(net),
    remaining: Math.abs(net),
    note: `لي عنده: ${fmt(p.receivable_total || 0, currency)} | عليه لي: ${fmt(p.payable_total || 0, currency)}`
  };
  if (shareCard) {
    await shareCard(fakeDebt, p.name, currency);
  } else {
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB");
    let lines = [
      "━━━━━━━━━━━━━━━━━━━━",
      "📊 تقرير GT-DAYN",
      `👤 الشخص: ${p.name}`,
      p.phone ? `📞 الهاتف: ${p.phone}` : "",
      `📅 التاريخ: ${today}`,
      "━━━━━━━━━━━━━━━━━━━━"
    ].filter(Boolean);
    for (const d of debts) {
      const pct = Math.round((d.amount - d.remaining) / d.amount * 100);
      const dir = d.type === "receivable" ? "🟣 لي عند" : "🔴 عليّ";
      lines.push("");
      lines.push(`${dir}: ${d.title}`);
      lines.push(`  المبلغ: ${fmt(d.amount, currency)}`);
      lines.push(`  المتبقي: ${fmt(d.remaining, currency)} (${pct}% مسدّد)`);
      if (d.status === "done") lines.push("  ✅ مكتمل");
    }
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push(`لي عنده: ${fmt(p.receivable_total || 0, currency)}`);
    lines.push(`عليّ له: ${fmt(p.payable_total || 0, currency)}`);
    lines.push(`الصافي:  ${net >= 0 ? "+" : ""}${fmt(net, currency)}`);
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("🔗 github.com/SalehGNUTUX/GT-DAYN");
    const text = lines.join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: `تقرير ${p.name}`, text });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    try {
      if ((_a = navigator.clipboard) == null ? void 0 : _a.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      toast("تم نسخ التقرير للحافظة ✓", "success");
    } catch (e) {
      toast("تعذّر النسخ: " + e.message, "error");
    }
  }
};
const _PWD_KEY = "gt-dayn-pwd-hash";
const _PWD_ENABLED_KEY = "gt-dayn-pwd-enabled";
(function initPasswordLock() {
  if (localStorage.getItem(_PWD_ENABLED_KEY) === null && localStorage.getItem(_PWD_KEY)) {
    localStorage.setItem(_PWD_ENABLED_KEY, "true");
  }
})();
function _hashPwd(raw) {
  return btoa(unescape(encodeURIComponent(raw + ":gt-dayn-2025")));
}
function _updatePwdUI() {
  _gtUpdateLockUI();
  const pwdHash = localStorage.getItem(_PWD_KEY);
  const enabled = localStorage.getItem(_PWD_ENABLED_KEY) === "true";
  const hasPassword = !!(pwdHash && pwdHash.trim() !== "");
  const active = hasPassword && enabled;
  const statusEl = document.getElementById("pwd-status");
  const toggle = document.getElementById("pwd-toggle");
  const changeRow = document.getElementById("change-pwd-row");
  if (statusEl) {
    statusEl.textContent = active ? "مفعّل ✓" : "غير مفعّل";
    statusEl.style.color = active ? "var(--success, #10b981)" : "var(--text-3, #9ca3af)";
  }
  if (toggle) {
    if (active) {
      toggle.classList.add("on");
      toggle.setAttribute("aria-checked", "true");
    } else {
      toggle.classList.remove("on");
      toggle.setAttribute("aria-checked", "false");
    }
  }
  if (changeRow) {
    changeRow.style.display = hasPassword ? "" : "none";
  }
}
window.togglePasswordLock = async function() {
  const pwdHash = localStorage.getItem(_PWD_KEY);
  const hasPassword = !!(pwdHash && pwdHash.trim() !== "");
  const currentEnabled = localStorage.getItem(_PWD_ENABLED_KEY) === "true";
  if (!hasPassword) {
    openPwdSetup();
    return;
  }
  if (currentEnabled) {
    const ok = await _gtShowPwdConfirm("إيقاف قفل فتح التطبيق");
    if (!ok) return;
  }
  const newEnabled = !currentEnabled;
  localStorage.setItem(_PWD_ENABLED_KEY, newEnabled ? "true" : "false");
  toast(newEnabled ? "تم تفعيل قفل التطبيق ✓" : "تم تعطيل قفل التطبيق", newEnabled ? "success" : "info");
  _updatePwdUI();
};
window.unlockApp = function() {
  const val = document.getElementById("lock-pwd-inp").value;
  const errEl = document.getElementById("lock-error");
  if (_hashPwd(val) === localStorage.getItem(_PWD_KEY)) {
    document.getElementById("lock-screen").style.display = "none";
    errEl.textContent = "";
  } else {
    errEl.textContent = "كلمة المرور غير صحيحة ❌";
    document.getElementById("lock-pwd-inp").value = "";
  }
};
window.openPwdSetup = function() {
  const active = !!localStorage.getItem(_PWD_KEY);
  if (active) {
    document.getElementById("pwd-modal-title").textContent = "إيقاف الحماية";
    document.getElementById("pwd-current-wrap").style.display = "";
    document.getElementById("pwd-new").closest(".input-wrap").style.display = "none";
    document.getElementById("pwd-confirm").closest(".input-wrap").style.display = "none";
    document.getElementById("pwd-save-btn").textContent = "إيقاف";
    document.getElementById("pwd-save-btn").onclick = _disablePwd;
  } else {
    document.getElementById("pwd-modal-title").textContent = "تعيين كلمة مرور";
    document.getElementById("pwd-current-wrap").style.display = "none";
    document.getElementById("pwd-new").closest(".input-wrap").style.display = "";
    document.getElementById("pwd-confirm").closest(".input-wrap").style.display = "";
    document.getElementById("pwd-save-btn").textContent = "حفظ";
    document.getElementById("pwd-save-btn").onclick = savePwd;
  }
  ["pwd-current", "pwd-new", "pwd-confirm"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  openModal("pwd-modal");
};
window.openChangePwd = function() {
  document.getElementById("pwd-modal-title").textContent = "تغيير كلمة المرور";
  document.getElementById("pwd-current-wrap").style.display = "";
  document.getElementById("pwd-new").closest(".input-wrap").style.display = "";
  document.getElementById("pwd-confirm").closest(".input-wrap").style.display = "";
  document.getElementById("pwd-save-btn").textContent = "حفظ";
  document.getElementById("pwd-save-btn").onclick = savePwd;
  ["pwd-current", "pwd-new", "pwd-confirm"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  openModal("pwd-modal");
};
window.savePwd = function() {
  const active = !!localStorage.getItem(_PWD_KEY);
  const curVal = document.getElementById("pwd-current").value;
  const newVal = document.getElementById("pwd-new").value;
  const confVal = document.getElementById("pwd-confirm").value;
  if (active && _hashPwd(curVal) !== localStorage.getItem(_PWD_KEY)) {
    toast("كلمة المرور الحالية غير صحيحة", "error");
    return;
  }
  if (newVal.length < 6) {
    toast("كلمة المرور قصيرة (6 أحرف على الأقل)", "error");
    return;
  }
  if (newVal !== confVal) {
    toast("كلمتا المرور غير متطابقتين", "error");
    return;
  }
  localStorage.setItem(_PWD_KEY, _hashPwd(newVal));
  localStorage.setItem(_PWD_ENABLED_KEY, "true");
  closeAllModals();
  toast("تم حفظ كلمة المرور ✓", "success");
  _updatePwdUI();
};
window._disablePwd = function() {
  const curVal = document.getElementById("pwd-current").value;
  if (_hashPwd(curVal) !== localStorage.getItem(_PWD_KEY)) {
    toast("كلمة المرور غير صحيحة", "error");
    return;
  }
  localStorage.removeItem(_PWD_KEY);
  localStorage.removeItem(_PWD_ENABLED_KEY);
  closeAllModals();
  toast("تم إيقاف الحماية", "info");
  _updatePwdUI();
};
(function() {
  const enabled = localStorage.getItem(_PWD_ENABLED_KEY) === "true";
  const pwdHash = localStorage.getItem(_PWD_KEY);
  if (enabled && pwdHash) {
    const ls = document.getElementById("lock-screen");
    if (ls) {
      ls.style.display = "flex";
      setTimeout(() => {
        var _a;
        return (_a = document.getElementById("lock-pwd-inp")) == null ? void 0 : _a.focus();
      }, 200);
    }
  }
})();
const _origRenderSettings = window.renderSettings;
window.renderSettings = async function() {
  if (_origRenderSettings) await _origRenderSettings();
  _updatePwdUI();
  const curObj = CURRENCIES.find((c) => c.sym === currency) || { sym: currency, code: "" };
  const lbl = document.getElementById("currency-lbl");
  if (lbl) lbl.textContent = `${curObj.sym} (${curObj.code})`;
};
const _origRenderCurrentPage = renderCurrentPage;
renderCurrentPage = async function() {
  if (currentPage === "person-profile") {
    await renderProfileDebts();
    return;
  }
  await _origRenderCurrentPage();
};
window.renderCurrentPage = renderCurrentPage;
let _calcTargetId = null;
let _calcExpr = "";
let _calcResult = 0;
let _calcHistory = [];
let _calcJustEvaled = false;
window._openCalcFull = window.openCalc = function(targetInputId) {
  var _a;
  _calcTargetId = targetInputId;
  _calcExpr = "";
  _calcJustEvaled = false;
  if (targetInputId) {
    const val = (_a = document.getElementById(targetInputId)) == null ? void 0 : _a.value;
    if (val && +val) {
      _calcExpr = val;
    }
  }
  _renderCalc();
  document.getElementById("calc-popup").classList.add("open");
  document.getElementById("settings-dropdown").classList.remove("active");
  document.getElementById("calc-use-btn").style.display = targetInputId ? "" : "none";
};
window.closeCalc = function() {
  document.getElementById("calc-popup").classList.remove("open");
};
window.calcInput = function(key) {
  const ops = ["+", "-", "*", "/"];
  const isOp = ops.includes(key);
  if (key === "C") {
    _calcExpr = "";
    _calcJustEvaled = false;
  } else if (key === "DEL") {
    if (_calcJustEvaled) {
      _calcExpr = "";
      _calcJustEvaled = false;
    } else _calcExpr = _calcExpr.slice(0, -1);
  } else if (key === "=") {
    _evalCalc();
  } else if (isOp) {
    const trimmed = _calcExpr.trimEnd();
    if (ops.some((o) => trimmed.endsWith(o))) {
      _calcExpr = trimmed.slice(0, -1) + key;
    } else if (_calcExpr !== "") {
      if (_calcJustEvaled) {
        _calcExpr = String(_calcResult) + key;
        _calcJustEvaled = false;
      } else _calcExpr += key;
    }
  } else if (key === "%") {
    if (_calcExpr) {
      try {
        const v = Function('"use strict";return (' + _calcExpr + ")")();
        _calcExpr = String(v / 100);
      } catch {
      }
    }
  } else {
    if (_calcJustEvaled && !isOp) {
      _calcExpr = "";
      _calcJustEvaled = false;
    }
    if (_calcExpr === "0" && key !== ".") _calcExpr = key;
    else _calcExpr += key;
  }
  _renderCalc();
};
function _evalCalc() {
  if (!_calcExpr) return;
  try {
    const safe = _calcExpr.replace(/[^0-9+\-*/.()%]/g, "");
    const result = Function('"use strict";return (' + safe + ")")();
    if (!isFinite(result)) {
      _renderCalc("خطأ");
      return;
    }
    const rounded = Math.round(result * 1e8) / 1e8;
    _calcHistory.unshift({ expr: _calcExpr, result: rounded });
    if (_calcHistory.length > 15) _calcHistory.pop();
    _calcResult = rounded;
    _calcJustEvaled = true;
    _renderCalcHistory();
    document.getElementById("calc-expr").textContent = _calcExpr + " =";
    document.getElementById("calc-val").textContent = _fmtNum(rounded);
    _calcExpr = String(rounded);
  } catch {
    document.getElementById("calc-val").textContent = "خطأ";
  }
}
function _fmtNum(n) {
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
function _renderCalc(err) {
  const expr = document.getElementById("calc-expr");
  const val = document.getElementById("calc-val");
  if (err) {
    val.textContent = err;
    return;
  }
  if (!_calcJustEvaled) {
    expr.textContent = _calcExpr;
    try {
      const safe = _calcExpr.replace(/[^0-9+\-*/.()%]/g, "").replace(/[+\-*/.]+$/, "");
      if (safe) {
        const v = Function('"use strict";return (' + safe + ")")();
        val.textContent = _fmtNum(v);
      } else {
        val.textContent = "0";
      }
    } catch {
      val.textContent = _calcExpr || "0";
    }
  }
}
function _renderCalcHistory() {
  const histEl = document.getElementById("calc-history");
  if (!_calcHistory.length) {
    histEl.classList.remove("has-items");
    return;
  }
  histEl.classList.add("has-items");
  histEl.innerHTML = _calcHistory.map(
    (h, i) => `<div class="calc-hist-row" onclick="calcUseHistResult(${i})">
        ${h.expr} = <strong>${_fmtNum(h.result)}</strong>
      </div>`
  ).join("");
}
window.calcUseHistResult = function(idx) {
  const item = _calcHistory[idx];
  if (!item) return;
  _calcResult = item.result;
  _calcExpr = String(item.result);
  _calcJustEvaled = true;
  document.getElementById("calc-expr").textContent = item.expr + " =";
  document.getElementById("calc-val").textContent = _fmtNum(item.result);
};
window.calcUseResult = function() {
  if (_calcTargetId) {
    const inp = document.getElementById(_calcTargetId);
    if (inp) {
      inp.value = _calcResult;
      inp.dispatchEvent(new Event("input"));
    }
  }
  closeCalc();
  toast(`تم استخدام: ${_fmtNum(_calcResult)}`, "success");
};
document.addEventListener("keydown", function(e) {
  if (!document.getElementById("calc-popup").classList.contains("open")) return;
  const map = {
    "Enter": "=",
    "Escape": "ESC",
    "Backspace": "DEL",
    "+": "+",
    "-": "-",
    "*": "*",
    "/": "/",
    "%": "%",
    ".": "."
  };
  if (e.key === "Escape") {
    closeCalc();
    return;
  }
  if (map[e.key]) {
    e.preventDefault();
    calcInput(map[e.key]);
    return;
  }
  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault();
    calcInput(e.key);
  }
});
async function recordDebtEdit(debtId, field, oldVal, newVal) {
  if (String(oldVal) === String(newVal)) return;
  await app.db.run(
    `INSERT INTO debt_edits (debt_id, field, old_value, new_value) VALUES (?,?,?,?)`,
    [debtId, field, String(oldVal), String(newVal)]
  );
}
(async function migrateDebtEdits() {
  await waitForApp();
  try {
    await app.db.run(`
        CREATE TABLE IF NOT EXISTS debt_edits (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          debt_id   INTEGER NOT NULL,
          field     TEXT    NOT NULL,
          old_value TEXT    NOT NULL,
          new_value TEXT    NOT NULL,
          edited_at TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `);
    await app.db.run(
      `CREATE INDEX IF NOT EXISTS idx_debt_edits ON debt_edits(debt_id)`
    );
  } catch {
  }
})();
window.archiveDebt = async function(debtId) {
  await waitForApp();
  if (window._GtSecure && !await window._GtSecure.requirePwd("delete", "أرشفة الدين")) return;
  await app.db.run(`UPDATE debts SET status='archived' WHERE id=?`, [debtId]);
  toast("تم أرشفة الدين", "info");
  await renderDebts();
};
window.restoreDebt = async function(debtId) {
  await waitForApp();
  const debt = await app.debts.getDebt(debtId);
  const newStatus = debt && debt.remaining <= 0 ? "done" : "active";
  await app.db.run(`UPDATE debts SET status=? WHERE id=?`, [newStatus, debtId]);
  toast("تمت الاستعادة ✓", "success");
  await renderDebts();
};
function _bkFilename(ext) {
  const now = /* @__PURE__ */ new Date();
  const date = now.toISOString().slice(0, 10);
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  const secs = String(now.getSeconds()).padStart(2, "0");
  return `GT-DAYN-${date}_${hours}-${mins}-${secs}.${ext}`;
}
async function _bkBuildJSON() {
  await waitForApp();
  const [
    persons,
    debts,
    payments,
    scheduled,
    budget,
    categories,
    expenses,
    settings
  ] = await Promise.all([
    app.db.query("SELECT * FROM persons"),
    app.db.query("SELECT * FROM debts"),
    app.db.query("SELECT * FROM payments"),
    app.db.query("SELECT * FROM scheduled_payments"),
    app.db.query("SELECT * FROM budget_months"),
    app.db.query("SELECT * FROM budget_categories"),
    app.db.query("SELECT * FROM budget_expenses"),
    app.db.query("SELECT * FROM settings")
  ]);
  return JSON.stringify({
    version: "1.0.3",
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    persons,
    debts,
    payments,
    scheduled,
    budget,
    categories,
    expenses,
    settings
  }, null, 2);
}
function _textToBase64(text) {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch (e) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
function _uint8ToBase64(arr) {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}
async function _saveToAndroidDownloads(data, filename, mimeType) {
  var _a, _b;
  const CapFS = (_b = (_a = window.Capacitor) == null ? void 0 : _a.Plugins) == null ? void 0 : _b.Filesystem;
  if (!CapFS) throw new Error("Filesystem plugin not available");
  const folderPath = `GT-DAYN`;
  const filePath = `${folderPath}/${filename}`;
  let base64Data;
  if (typeof data === "string") {
    base64Data = _textToBase64(data);
  } else if (data instanceof Uint8Array) {
    base64Data = _uint8ToBase64(data);
  } else {
    const blob = new Blob([data], { type: mimeType });
    const reader = new FileReader();
    base64Data = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  try {
    await CapFS.mkdir({
      path: folderPath,
      directory: "DOCUMENTS",
      recursive: true
    });
  } catch (e) {
  }
  await CapFS.writeFile({
    path: filePath,
    data: base64Data,
    directory: "DOCUMENTS"
  });
  return filePath;
}
async function _shareOnAndroid(data, filename, mimeType, title) {
  var _a, _b, _c, _d;
  const CapFS = (_b = (_a = window.Capacitor) == null ? void 0 : _a.Plugins) == null ? void 0 : _b.Filesystem;
  const Share = (_d = (_c = window.Capacitor) == null ? void 0 : _c.Plugins) == null ? void 0 : _d.Share;
  if (!CapFS || !Share) {
    throw new Error("Plugins not available");
  }
  const filePath = await _saveToAndroidDownloads(data, filename, mimeType);
  const fileUri = await CapFS.getUri({
    path: filePath,
    directory: "DOCUMENTS"
  });
  try {
    await Share.share({
      title,
      text: "نسخة احتياطية من GT-DAYN",
      url: fileUri.uri,
      dialogTitle: "اختر تطبيق المشاركة"
    });
    return true;
  } catch (err) {
    if (err.message && err.message.includes("canceled")) {
      return false;
    }
    throw err;
  }
}
async function _saveOnWeb(data, filename, mimeType) {
  if (window.showSaveFilePicker) {
    try {
      const opts = {
        suggestedName: filename,
        types: [{
          description: mimeType.includes("json") ? "JSON Files" : "SQLite Database",
          accept: { [mimeType]: mimeType.includes("json") ? [".json"] : [".sqlite", ".db"] }
        }]
      };
      const handle = await window.showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      const blob2 = typeof data === "string" ? new Blob([data], { type: mimeType }) : new Blob([data], { type: mimeType });
      await writable.write(blob2);
      await writable.close();
      return handle.name;
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("تم إلغاء الحفظ");
      }
    }
  }
  const blob = typeof data === "string" ? new Blob([data], { type: mimeType }) : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5e3);
  return filename;
}
async function _shareOnWeb(data, filename, mimeType, title) {
  if (!navigator.share) {
    throw new Error("المشاركة غير مدعومة");
  }
  const blob = typeof data === "string" ? new Blob([data], { type: mimeType }) : new Blob([data], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });
  const shareData = {
    title,
    text: "نسخة احتياطية من GT-DAYN"
  };
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ ...shareData, files: [file] });
  } else {
    const url = URL.createObjectURL(blob);
    await navigator.share({ ...shareData, url });
    setTimeout(() => URL.revokeObjectURL(url), 3e4);
  }
}
window.backupDownload = async function(type) {
  var _a, _b, _c;
  try {
    await waitForApp();
    const filename = _bkFilename(type === "json" ? "json" : "sqlite");
    const isNative = (_b = (_a = window.Capacitor) == null ? void 0 : _a.isNativePlatform) == null ? void 0 : _b.call(_a);
    const mimeType = type === "json" ? "application/json" : "application/vnd.sqlite3";
    let data;
    if (type === "json") {
      data = await _bkBuildJSON();
    } else {
      data = await app.db.export();
    }
    if (isNative) {
      const path = await _saveToAndroidDownloads(data, filename, mimeType);
      toast("تم الحفظ: " + path, "success");
    } else {
      const savedName = await _saveOnWeb(data, filename, mimeType);
      toast("تم الحفظ: " + savedName, "success");
    }
  } catch (e) {
    if (e.name !== "AbortError" && !((_c = e.message) == null ? void 0 : _c.includes("canceled"))) {
      toast("فشل الحفظ: " + (e.message || e), "error");
      console.error("Save error:", e);
    }
  }
};
window.backupShare = async function(type) {
  var _a, _b, _c;
  try {
    await waitForApp();
    const filename = _bkFilename(type === "json" ? "json" : "sqlite");
    const isNative = (_b = (_a = window.Capacitor) == null ? void 0 : _a.isNativePlatform) == null ? void 0 : _b.call(_a);
    const mimeType = type === "json" ? "application/json" : "application/vnd.sqlite3";
    const title = type === "json" ? "GT-DAYN — نسخة احتياطية JSON" : "GT-DAYN — قاعدة البيانات";
    let data;
    if (type === "json") {
      data = await _bkBuildJSON();
    } else {
      data = await app.db.export();
    }
    if (isNative) {
      await _shareOnAndroid(data, filename, mimeType, title);
      toast("تمت المشاركة ✓", "success");
    } else {
      await _shareOnWeb(data, filename, mimeType, title);
      toast("تمت المشاركة ✓", "success");
    }
  } catch (e) {
    if (e.name !== "AbortError" && !((_c = e.message) == null ? void 0 : _c.includes("canceled"))) {
      toast("فشل المشاركة: " + (e.message || e), "error");
      console.error("Share error:", e);
    }
  }
};
const BACKUP_STORAGE_KEY = "gt-dayn-backup-settings";
function _getBackupSettings() {
  try {
    const saved = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
  }
  return {
    autoBackup: true,
    lastSavePath: null,
    autoBackupPath: null,
    autoBackupCount: 0
  };
}
function _saveBackupSettings(settings) {
  localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(settings));
}
function _updateAutoBackupUI() {
  const settings = _getBackupSettings();
  const toggle = document.getElementById("auto-backup-toggle");
  const status = document.getElementById("auto-backup-status");
  const pathRow = document.getElementById("auto-backup-path-row");
  const pathDisplay = document.getElementById("auto-backup-path");
  const folderBtn = document.getElementById("choose-auto-folder-btn");
  if (toggle) toggle.classList.toggle("active", settings.autoBackup);
  if (status) {
    let txt = settings.autoBackup ? "مُفعّل ✓" : "غير مُفعّل";
    if (settings.autoBackup && settings.lastAutoBackupTime) {
      const t = new Date(settings.lastAutoBackupTime);
      txt += " — آخر حفظ: " + t.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
    } else if (settings.autoBackup) {
      txt += " — في انتظار أول تعديل";
    }
    status.textContent = txt;
  }
  if (pathRow) pathRow.style.display = settings.autoBackupPath ? "flex" : "none";
  if (pathDisplay && settings.autoBackupPath) pathDisplay.textContent = settings.autoBackupPath;
  if (folderBtn) folderBtn.style.display = settings.autoBackup ? "flex" : "none";
  const lastPathRow = document.getElementById("last-save-path-row");
  const lastPathDisplay = document.getElementById("last-save-path");
  const lastPath = settings.lastSavePath || settings.lastAutoBackupFile || "";
  if (lastPathRow && lastPath) {
    lastPathRow.style.display = "flex";
    if (lastPathDisplay) lastPathDisplay.textContent = lastPath;
  }
}
window.toggleAutoBackup = function() {
  const settings = _getBackupSettings();
  settings.autoBackup = !settings.autoBackup;
  _saveBackupSettings(settings);
  _updateAutoBackupUI();
  toast(settings.autoBackup ? "تم تفعيل الحفظ التلقائي ✓" : "تم إلغاء الحفظ التلقائي", "info");
};
window.chooseAutoBackupFolder = async function() {
  if (!window.showDirectoryPicker) {
    toast("منتقي المجلدات غير متاح على هذا الجهاز", "error");
    return;
  }
  try {
    const dirHandle = await window.showDirectoryPicker();
    const settings = _getBackupSettings();
    settings.autoBackupPath = dirHandle.name;
    _saveBackupSettings(settings);
    _updateAutoBackupUI();
    toast("تم اختيار مجلد: " + dirHandle.name, "success");
  } catch (e) {
    if (e.name !== "AbortError") {
      toast("فشل اختيار المجلد", "error");
    }
  }
};
async function _triggerAutoBackup() {
  var _a, _b, _c, _d;
  const settings = _getBackupSettings();
  if (!settings.autoBackup) return;
  const filename = "GT-DAYN-" + (/* @__PURE__ */ new Date()).toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 19) + ".json";
  try {
    await waitForApp();
    const data = await _bkBuildJSON();
    if ((_b = (_a = window.Capacitor) == null ? void 0 : _a.isNativePlatform) == null ? void 0 : _b.call(_a)) {
      const CapFS = (_d = (_c = window.Capacitor) == null ? void 0 : _c.Plugins) == null ? void 0 : _d.Filesystem;
      if (!CapFS) {
        console.warn("[AutoBackup] CapFS not available");
        return;
      }
      const folder = "GT-DAYN/AutoBackup";
      const path = folder + "/" + filename;
      const dirs = ["DOCUMENTS", "DATA", "CACHE"];
      let saved = false;
      for (const dir of dirs) {
        try {
          await CapFS.mkdir({ path: folder, directory: dir, recursive: true }).catch(() => {
          });
          await CapFS.writeFile({ path, data: _textToBase64(data), directory: dir });
          settings.autoBackupCount = (settings.autoBackupCount || 0) + 1;
          settings.autoBackupPath = dir + "/" + folder;
          settings.lastAutoBackupFile = path;
          settings.lastAutoBackupTime = (/* @__PURE__ */ new Date()).toISOString();
          _saveBackupSettings(settings);
          console.log("[AutoBackup] ✓ saved to " + dir + "/" + path);
          if (typeof _updateAutoBackupUI === "function") _updateAutoBackupUI();
          saved = true;
          break;
        } catch (e) {
          console.warn("[AutoBackup] failed with dir=" + dir + ":", e.message);
        }
      }
      if (!saved) {
        _autoBackupToLocalStorage(data, filename, settings);
      }
    } else if (window.__ELECTRON__) {
      try {
        if (window._autoBackupDirHandle) {
          const fh = await window._autoBackupDirHandle.getFileHandle(filename, { create: true });
          const wr = await fh.createWritable();
          await wr.write(data);
          await wr.close();
          settings.autoBackupCount = (settings.autoBackupCount || 0) + 1;
          settings.lastAutoBackupFile = filename;
          settings.lastAutoBackupTime = (/* @__PURE__ */ new Date()).toISOString();
          _saveBackupSettings(settings);
          console.log("[AutoBackup] ✓ Electron saved:", filename);
          if (typeof _updateAutoBackupUI === "function") _updateAutoBackupUI();
        } else {
          _autoBackupToLocalStorage(data, filename, settings);
        }
      } catch (e) {
        _autoBackupToLocalStorage(data, filename, settings);
      }
    } else {
      _autoBackupToLocalStorage(data, filename, settings);
    }
  } catch (e) {
    console.error("[AutoBackup] error:", e.message);
  }
}
function _autoBackupToLocalStorage(data, filename, settings) {
  try {
    localStorage.setItem("gt-dayn-auto-backup-data", data);
    localStorage.setItem("gt-dayn-auto-backup-name", filename);
    localStorage.setItem("gt-dayn-auto-backup-time", (/* @__PURE__ */ new Date()).toISOString());
    settings.autoBackupCount = (settings.autoBackupCount || 0) + 1;
    settings.lastAutoBackupFile = filename + " (localStorage)";
    settings.lastAutoBackupTime = (/* @__PURE__ */ new Date()).toISOString();
    _saveBackupSettings(settings);
    console.log("[AutoBackup] ✓ localStorage fallback:", filename);
    if (typeof _updateAutoBackupUI === "function") _updateAutoBackupUI();
  } catch (e) {
    console.warn("[AutoBackup] localStorage failed:", e.message);
  }
}
function _setupAutoBackupTriggers() {
  const _origRenderDebts = renderDebts;
  const _origRenderBudget = renderBudget;
  const _origRenderPersons = renderPersons;
  renderDebts = async function(...a) {
    const r = await _origRenderDebts(...a);
    window._autoBackupDirty = true;
    return r;
  };
  renderBudget = async function(...a) {
    const r = await _origRenderBudget(...a);
    window._autoBackupDirty = true;
    return r;
  };
  renderPersons = async function(...a) {
    const r = await _origRenderPersons(...a);
    window._autoBackupDirty = true;
    return r;
  };
  window._autoBackupInterval = setInterval(async () => {
    if (!window._autoBackupDirty) return;
    const settings = _getBackupSettings();
    if (!settings.autoBackup) {
      window._autoBackupDirty = false;
      return;
    }
    window._autoBackupDirty = false;
    await _triggerAutoBackup();
  }, 5e3);
  console.log("[AutoBackup] triggers ready — interval mode");
}
window.backupDownloadWithPicker = async function(type) {
  var _a, _b;
  try {
    await waitForApp();
    const filename = _bkFilename(type === "json" ? "json" : "sqlite");
    const isNative = (_b = (_a = window.Capacitor) == null ? void 0 : _a.isNativePlatform) == null ? void 0 : _b.call(_a);
    let data;
    if (type === "json") {
      data = await _bkBuildJSON();
    } else {
      data = await app.db.export();
    }
    const mimeType = type === "json" ? "application/json" : "application/vnd.sqlite3";
    if (isNative) {
      await _saveWithAndroidPicker(data, filename, mimeType);
    } else {
      const savedName = await _saveWithWebPicker(data, filename, mimeType);
      toast("تم الحفظ: " + savedName, "success");
    }
  } catch (e) {
    if (e.name !== "AbortError") {
      toast("فشل الحفظ: " + (e.message || e), "error");
      console.error("Save error:", e);
    }
  }
};
window.backupToLastPath = async function() {
  const settings = _getBackupSettings();
  if (!settings.lastSavePath) {
    toast("لا يوجد مجلد سابق", "error");
    return;
  }
  await window.backupDownload("json");
};
async function _saveWithAndroidPicker(data, filename, mimeType) {
  var _a, _b, _c, _d;
  const CapFS = (_b = (_a = window.Capacitor) == null ? void 0 : _a.Plugins) == null ? void 0 : _b.Filesystem;
  if (!CapFS) {
    throw new Error("Filesystem plugin not available");
  }
  try {
    const tempPath = `temp/${filename}`;
    const base64Data = typeof data === "string" ? _textToBase64(data) : _uint8ToBase64(data);
    await CapFS.mkdir({ path: "temp", directory: "CACHE", recursive: true });
    await CapFS.writeFile({
      path: tempPath,
      data: base64Data,
      directory: "CACHE"
    });
    const fileUri = await CapFS.getUri({ path: tempPath, directory: "CACHE" });
    const Share = (_d = (_c = window.Capacitor) == null ? void 0 : _c.Plugins) == null ? void 0 : _d.Share;
    if (Share) {
      await Share.share({
        title: `حفظ ${filename}`,
        text: "اختر التطبيق لحفظ الملف (Drive, Files...)",
        url: fileUri.uri,
        dialogTitle: "حفظ الملف في..."
      });
      toast("تم فتح منتقي التطبيقات", "success");
      const settings = _getBackupSettings();
      settings.lastSavePath = "Documents/GT-DAYN";
      _saveBackupSettings(settings);
      _updateAutoBackupUI();
    } else {
      const path = await _saveToAndroidDownloads(data, filename, mimeType);
      toast("تم الحفظ: " + path, "success");
    }
  } catch (err) {
    const path = await _saveToAndroidDownloads(data, filename, mimeType);
    toast("تم الحفظ: " + path, "success");
    const settings = _getBackupSettings();
    settings.lastSavePath = path;
    _saveBackupSettings(settings);
    _updateAutoBackupUI();
  }
}
async function _saveWithWebPicker(data, filename, mimeType) {
  if (!window.showSaveFilePicker) {
    return await _saveOnWeb(data, filename, mimeType);
  }
  const opts = {
    suggestedName: filename,
    types: [{
      description: mimeType.includes("json") ? "JSON Files" : "SQLite Database",
      accept: { [mimeType]: mimeType.includes("json") ? [".json"] : [".sqlite", ".db"] }
    }]
  };
  const handle = await window.showSaveFilePicker(opts);
  const writable = await handle.createWritable();
  const blob = typeof data === "string" ? new Blob([data], { type: mimeType }) : new Blob([data], { type: mimeType });
  await writable.write(blob);
  await writable.close();
  const settings = _getBackupSettings();
  settings.lastSavePath = handle.name;
  _saveBackupSettings(settings);
  _updateAutoBackupUI();
  return handle.name;
}
window.importBackup = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await waitForApp();
    if (file.name.endsWith(".sqlite") || file.name.endsWith(".db")) {
      const buf = await file.arrayBuffer();
      await app.db.import(new Uint8Array(buf));
      toast("تمت الاستعادة ✓ — يُعاد تحميل التطبيق...", "success");
      setTimeout(() => location.reload(), 1800);
    } else {
      const text = await file.text();
      const event_ = { target: { files: [file] } };
      await importJSON({ target: { files: [new File([text], file.name)] } });
    }
  } catch (err) {
    toast("فشل الاستيراد: " + (err.message || err), "error");
  } finally {
    e.target.value = "";
  }
};
window.exportJSON = window.exportJSON || exportJSON;
window.exportSQLite = window.exportSQLite || exportSQLite;
