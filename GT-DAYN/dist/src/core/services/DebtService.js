/**
 * GT-DAYN — DebtService.js
 * إدارة الديون والأشخاص والدفعات
 * يعمل على كل المنصات عبر DbAdapter
 */

export class DebtService {
  constructor(db) { this._db = db; }

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
      `SELECT * FROM persons WHERE id = ?`, [id]
    );
    return rows[0] ?? null;
  }

  async addPerson({ name, avatar = null, phone = null, note = null }) {
    // التحقق من تكرار رقم الهاتف
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
    // التحقق من تكرار رقم الهاتف عند التعديل
    if (fields.phone && fields.phone.trim()) {
      const existing = await this._db.query(
        `SELECT id, name FROM persons WHERE phone=? AND id!=? LIMIT 1`,
        [fields.phone.trim(), id]
      );
      if (existing.length) {
        throw new Error(`رقم الهاتف مُسجَّل مسبقاً باسم: ${existing[0].name}`);
      }
    }
    const cols = Object.keys(fields).map(k => `${k}=?`).join(',');
    await this._db.run(
      `UPDATE persons SET ${cols} WHERE id=?`,
      [...Object.values(fields), id]
    );
  }

  async deletePerson(id) {
    // CASCADE يحذف الديون والدفعات تلقائياً
    await this._db.run(`DELETE FROM persons WHERE id=?`, [id]);
  }

  // ══ الديون ═════════════════════════════════════════════════════════════════

  async getDebts({ personId = null, type = null, status = null } = {}) {
    const conditions = ['1=1'];
    const params     = [];

    if (personId) { conditions.push('d.person_id=?'); params.push(personId); }
    if (type)     { conditions.push('d.type=?');       params.push(type);     }
    if (status === null) {
      // لا تُخفِ المكتملة — اعرض كل شيء إلا المؤرشَف
      conditions.push("d.status != 'archived'");
    } else if (status) {
      conditions.push('d.status=?');
      params.push(status);
    }

    return this._db.query(`
      SELECT d.*, p.name AS person_name, p.avatar AS person_avatar
      FROM debts d
      JOIN persons p ON p.id = d.person_id
      WHERE ${conditions.join(' AND ')}
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

  async addDebt({ personId, type, title, amount, note = null, currency = null }) {
    // currency=null يسبب خطأ NOT NULL في Android — نستخدم 'MAD' كافتراضي
    const cur = currency || 'MAD';
    const { lastInsertRowid } = await this._db.run(`
      INSERT INTO debts (person_id, type, title, amount, remaining, note, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [personId, type, title.trim(), amount, amount, note, cur]);
    return lastInsertRowid;
  }

  async updateDebt(id, fields) {
    const allowed = ['title', 'amount', 'remaining', 'note', 'status', 'sort_order', 'type', 'currency'];
    const cols    = Object.keys(fields).filter(k => allowed.includes(k));
    if (!cols.length) return;
    await this._db.run(
      `UPDATE debts SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=?`,
      [...cols.map(c => fields[c]), id]
    );
    // إذا تغيّر amount: أعد حساب remaining = newAmount - totalPaid
    if ('amount' in fields) {
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
    // نقل للأرشيف بدل الحذف المباشر (للديون المكتملة)
    const debt = await this.getDebt(id);
    if (debt?.status === 'done') {
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
    const date = paidAt ?? new Date().toISOString();
    const { lastInsertRowid } = await this._db.run(
      `INSERT INTO payments (debt_id, amount, note, paid_at) VALUES (?, ?, ?, ?)`,
      [debtId, amount, note, date]
    );
    // trigger trg_recalc_remaining يُحدّث remaining تلقائياً
    return lastInsertRowid;
  }

  async updatePayment(id, { amount, note, paidAt }) {
    await this._db.run(
      `UPDATE payments SET amount=?, note=?, paid_at=? WHERE id=?`,
      [amount, note, paidAt, id]
    );
    // نعيد حساب remaining يدوياً لأن الـ trigger يعمل على INSERT فقط
    const rows = await this._db.query(
      `SELECT debt_id FROM payments WHERE id=?`, [id]
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
    const today = new Date().toISOString().slice(0, 10);
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
    if (!debt) throw new Error('DEBT_NOT_FOUND');

    // حذف الجدول القديم
    await this._db.run(
      `DELETE FROM scheduled_payments WHERE debt_id=? AND status='pending'`,
      [debtId]
    );

    const perAmount = Math.round((debt.remaining / count) * 100) / 100;
    const start     = new Date(startDate);

    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      if (freqType === 'daily')   d.setDate(d.getDate() + i);
      if (freqType === 'weekly')  d.setDate(d.getDate() + i * 7);
      if (freqType === 'monthly') d.setMonth(d.getMonth() + i);

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
      totalPayable:    s.total_payable    ?? 0,
      net:             (s.total_receivable ?? 0) - (s.total_payable ?? 0),
      activeCount:     s.active_count     ?? 0,
      doneCount:       s.done_count       ?? 0,
    };
  }
}
