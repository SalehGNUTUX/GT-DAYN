/**
 * GT-DAYN — NotificationService.js
 * تنبيهات الدفعات المستحقة عبر Web Notifications API
 * يعمل مع Service Worker للإشعارات في الخلفية
 */

export class NotificationService {
  constructor(db) { this._db = db; }

  /** طلب إذن الإشعارات */
  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied')  return 'denied';
    return Notification.requestPermission();
  }

  /**
   * جدولة فحص يومي للدفعات المستحقة
   * يُشغَّل عند تحميل التطبيق
   */
  async scheduleDailyCheck(debtService) {
    const perm = await this.requestPermission();
    if (perm !== 'granted') return;

    // فحص فوري عند الفتح
    await this.checkAndNotify(debtService);

    // إعداد فحص يومي (كل 24 ساعة)
    const INTERVAL = 24 * 60 * 60 * 1000;
    setInterval(() => this.checkAndNotify(debtService), INTERVAL);
  }

  async checkAndNotify(debtService) {
    try {
      const dues = await debtService.getDueToday();
      for (const d of dues) {
        await this._notify({
          title: `دفعة مستحقة — ${d.person_name}`,
          body:  `${d.debt_title}: ${Math.round(d.amount).toLocaleString('ar-SA')} — مستحقة اليوم`,
          tag:   `due-${d.id}`,     // منع التكرار
          data:  { debtId: d.debt_id, schedId: d.id },
        });
      }
    } catch { /* تجاهل أخطاء التحقق */ }
  }

  async _notify({ title, body, tag, data }) {
    if (!('serviceWorker' in navigator)) {
      // fallback: إشعار مباشر
      new Notification(title, { body, dir: 'rtl', lang: 'ar', icon: './icons/icon-192.png' });
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      dir:     'rtl',
      lang:    'ar',
      icon:    './icons/icon-192.png',
      badge:   './icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag,
      data,
    });
  }

  /**
   * جدولة إشعار في تاريخ محدد (عبر Push API — يحتاج سيرفر)
   * للآن: يحفظ في IndexedDB ويفحصه Service Worker
   */
  async scheduleForDate(debtId, dueDate, amount, personName) {
    // نحفظ الجدولة في قاعدة البيانات — يُقرأ عند تحميل الصفحة
    await this._db.run(`
      INSERT OR IGNORE INTO scheduled_payments (debt_id, amount, due_date, freq_type)
      VALUES (?, ?, ?, 'monthly')
    `, [debtId, amount, dueDate]);
  }
}
