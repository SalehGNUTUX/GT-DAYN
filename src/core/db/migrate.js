/**
 * GT-DAYN — migrate.js
 * استيراد البيانات القديمة من localStorage (مفتاح my_debts_final_v3)
 * إلى قاعدة البيانات الجديدة SQLite
 *
 * يُشغَّل مرة واحدة فقط عند أول تشغيل للتطبيق
 */

export async function migrateFromLegacy(db) {
  // تحقق هل سبق ترحيل البيانات
  const flag = await db.query(`SELECT value FROM settings WHERE key='migrated_v3'`);
  if (flag.length && flag[0].value === '1') return { migrated: false, reason: 'already_done' };

  const raw = localStorage.getItem('my_debts_final_v3');
  if (!raw) {
    await db.run(`INSERT OR REPLACE INTO settings VALUES ('migrated_v3','1')`);
    return { migrated: false, reason: 'no_legacy_data' };
  }

  let legacyDebts;
  try {
    legacyDebts = JSON.parse(raw);
  } catch {
    return { migrated: false, reason: 'parse_error' };
  }

  if (!Array.isArray(legacyDebts) || !legacyDebts.length) {
    await db.run(`INSERT OR REPLACE INTO settings VALUES ('migrated_v3','1')`);
    return { migrated: false, reason: 'empty' };
  }

  let imported = 0;

  for (const old of legacyDebts) {
    // 1. إنشاء الشخص أو إيجاده
    const nameRaw = (old.personName ?? old.name ?? 'مجهول').trim();
    let personId;

    const existing = await db.query(
      `SELECT id FROM persons WHERE name=? LIMIT 1`, [nameRaw]
    );

    if (existing.length) {
      personId = existing[0].id;
    } else {
      const { lastInsertRowid } = await db.run(
        `INSERT INTO persons (name) VALUES (?)`, [nameRaw]
      );
      personId = lastInsertRowid;
    }

    // 2. إدراج الدين
    // البيانات القديمة: المستخدم هو الدائن دائماً (receivable)
    const title     = (old.title ?? old.note ?? 'دين منقول').trim();
    const amount    = parseFloat(old.amount)    || 0;
    const remaining = parseFloat(old.remaining ?? old.amount) || amount;
    const createdAt = old.date ?? old.createdAt ?? new Date().toISOString();
    const status    = remaining <= 0 ? 'done' : 'active';

    const { lastInsertRowid: debtId } = await db.run(`
      INSERT INTO debts (person_id, type, title, amount, remaining, note, status, created_at, updated_at)
      VALUES (?, 'receivable', ?, ?, ?, ?, ?, ?, ?)
    `, [personId, title, amount, remaining, old.note ?? null, status, createdAt, createdAt]);

    // 3. ترحيل سجل المدفوعات
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

    // 4. ترحيل الجدولة
    const schedule = old.schedule ?? old.scheduledPayments ?? [];
    for (const s of schedule) {
      const sAmount  = parseFloat(s.amount) || 0;
      const sDueDate = (s.dueDate ?? s.due_date ?? '').slice(0, 10);
      const sFreq    = s.frequency ?? s.freqType ?? 'monthly';
      if (!sAmount || !sDueDate) continue;
      await db.run(`
        INSERT INTO scheduled_payments (debt_id, amount, due_date, freq_type, status)
        VALUES (?, ?, ?, ?, ?)
      `, [debtId, sAmount, sDueDate, sFreq, s.status ?? 'pending']);
    }

    imported++;
  }

  // وضع علامة الترحيل
  await db.run(`INSERT OR REPLACE INTO settings VALUES ('migrated_v3','1')`);

  // احتياطياً: إبقاء البيانات القديمة في localStorage تحت مفتاح archive
  try {
    localStorage.setItem('my_debts_final_v3_archive', raw);
    localStorage.removeItem('my_debts_final_v3');
  } catch { /* تجاهل أخطاء التخزين */ }

  return { migrated: true, count: imported };
}
