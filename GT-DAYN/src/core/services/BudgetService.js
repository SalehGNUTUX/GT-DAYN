/**
 * GT-DAYN — BudgetService.js
 */

export class BudgetService {
  constructor(db) { this._db = db; }

  static currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  async getMonth(month = BudgetService.currentMonth()) {
    const rows = await this._db.query(`SELECT * FROM budget_months WHERE month=?`, [month]);
    return rows[0] ?? null;
  }

  async getOrCreateMonth(month = BudgetService.currentMonth(), income = 0) {
    let row = await this.getMonth(month);
    if (!row) {
      const result = await this._db.run(
        `INSERT INTO budget_months (month, income) VALUES (?, ?)`, [month, income]
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

  async addCategory(month, { name, icon = '💰', color = null, budgetCap = 0, linkedType = null, dueDay = null }) {
    const bm   = await this.getOrCreateMonth(month);
    const last = await this._db.query(
      `SELECT MAX(sort_order) AS mx FROM budget_categories WHERE month_id=?`, [bm.id]
    );
    const order = (last[0]?.mx ?? -1) + 1;
    const result = await this._db.run(`
      INSERT INTO budget_categories (month_id, name, icon, color, budget_cap, linked_type, due_day, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [bm.id, name.trim(), icon, color, budgetCap, linkedType, dueDay, order]);
    return { id: result.lastInsertRowid };
  }

  async updateCategory(id, fields) {
    const allowed = ['name', 'icon', 'color', 'budget_cap', 'due_day', 'sort_order', 'linked_type'];
    const cols = Object.keys(fields).filter(k => allowed.includes(k));
    if (!cols.length) return;
    await this._db.run(
      `UPDATE budget_categories SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=?`,
      [...cols.map(c => fields[c]), id]
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
    const date = expenseDate ?? new Date().toISOString().slice(0, 10);
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
    const debtCat = cats.find(c => c.linked_type === 'debt_payments');
    if (!debtCat) return;
    const existing = await this._db.query(
      `SELECT id FROM budget_expenses WHERE payment_id=?`, [paymentId]
    );
    if (existing.length) return;
    await this.addExpense(debtCat.id, { amount, note: 'سداد دين (تلقائي)', paymentId });
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
      income:           bm.income,
      totalSpent,
      remaining:        (bm.income || 0) - totalSpent,
      spentPct:         bm.income > 0 ? Math.round(totalSpent * 100 / bm.income) : 0,
      activeCategories: s.active_categories ?? 0,
    };
  }

  async getSuggestion(month = BudgetService.currentMonth()) {
    const summary = await this.getMonthSummary(month);
    if (!summary || summary.remaining <= 0) return null;

    // اقترح تسديد ديون علي (payable) فقط — ليس ديون لي
    const payableDebts = await this._db.query(`
      SELECT d.*, p.name AS person_name
      FROM debts d JOIN persons p ON p.id = d.person_id
      WHERE d.status='active' AND d.type='payable'
      ORDER BY (d.remaining / d.amount) ASC
      LIMIT 1
    `);

    if (payableDebts.length) {
      return {
        type:      'pay_debt',
        amount:    Math.min(summary.remaining, payableDebts[0].remaining),
        debt:      payableDebts[0],
        remaining: summary.remaining,
      };
    }

    // إذا لم توجد ديون علي — تحقق من ديون لي لإشعار التحصيل
    const receivableDebts = await this._db.query(`
      SELECT d.*, p.name AS person_name
      FROM debts d JOIN persons p ON p.id = d.person_id
      WHERE d.status='active' AND d.type='receivable'
      ORDER BY d.remaining DESC
      LIMIT 1
    `);

    if (receivableDebts.length) {
      return {
        type:      'collect_debt',
        amount:    receivableDebts[0].remaining,
        debt:      receivableDebts[0],
        remaining: summary.remaining,
      };
    }

    return { type: 'save', amount: summary.remaining };
  }
}
