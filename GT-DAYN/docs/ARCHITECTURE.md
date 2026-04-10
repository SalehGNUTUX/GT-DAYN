<div dir="rtl">

# GT-DAYN — سجل الديون الذكي

[![version](https://img.shields.io/badge/version-1.0.0-blue)]()
[![PWA](https://img.shields.io/badge/PWA-Enabled-brightgreen)]()
[![SQLite](https://img.shields.io/badge/DB-SQLite-orange)]()
[![Platforms](https://img.shields.io/badge/platforms-Web%20%7C%20Electron%20%7C%20Android-purple)]()

مدير مالي شخصي متكامل: ديون ثنائية الاتجاه + مصاريف شهرية + مزامنة Drive.

---

## 🗂 هيكل المشروع

```
gt-dayn/
│
├── src/                          ← الكود المشترك بين كل المنصات
│   ├── core/
│   │   ├── App.js               ← نقطة الدخول + كاشف المنصة
│   │   ├── db/
│   │   │   ├── schema.sql       ← مخطط SQLite الموحد ★
│   │   │   ├── DbAdapter.js     ← واجهة مجردة
│   │   │   ├── WebSQLiteAdapter.js    ← sql.js + OPFS/IDB
│   │   │   ├── ElectronAdapter.js     ← IPC → better-sqlite3
│   │   │   └── CapacitorAdapter.js    ← @capacitor/sqlite
│   │   └── services/
│   │       ├── DebtService.js   ← الديون + الأشخاص + الدفعات
│   │       ├── BudgetService.js ← الميزانية الشهرية
│   │       └── DriveService.js  ← مزامنة Google Drive
│   │
│   └── ui/                      ← الواجهة المشتركة
│       ├── components/          ← مكوّنات قابلة للإعادة
│       ├── pages/               ← صفحات (Debts / Budget / Persons)
│       └── styles/              ← CSS Variables + Themes
│
├── platforms/
│   ├── web/                     ← PWA
│   │   ├── index.html
│   │   └── sw.js                ← (تُولّده vite-plugin-pwa)
│   ├── electron/                ← سطح المكتب
│   │   ├── main.js              ← Main Process
│   │   └── preload.js           ← IPC Bridge
│   └── android/
│       └── capacitor.config.ts  ← إعدادات Capacitor
│
├── docs/
│   └── ARCHITECTURE.md          ← هذا الملف
│
├── package.json                 ← npm scripts موحدة
└── vite.config.js               ← Bundler + PWA plugin
```

---

## ⚙️ طبقة قاعدة البيانات

| المنصة | المحرّك | مكان الحفظ |
|--------|---------|------------|
| Web / PWA | `sql.js` (SQLite WASM) | OPFS أو IndexedDB |
| Electron | `better-sqlite3` (native) | `%AppData%/gt-dayn/gt-dayn.sqlite` |
| Android | `@capacitor-community/sqlite` | تخزين التطبيق الداخلي |

جميع المنصات تستخدم **نفس** `schema.sql` — مخطط واحد لا تناقض.

---

## 🔐 مزامنة Google Drive

- OAuth2 عبر **Google Identity Services** (GIS) — بدون redirect
- يحفظ ملفاً واحداً في `appDataFolder` (مجلد خاص بالتطبيق، غير مرئي للمستخدم)
- رفع = تصدير `Uint8Array` من SQLite → رفع multipart
- تنزيل = جلب الملف → `db.import()` على المحرّك المناسب

للإعداد:
1. أنشئ مشروع في [Google Cloud Console](https://console.cloud.google.com/)
2. فعّل **Google Drive API**
3. أنشئ OAuth 2.0 Client ID (Web Application)
4. أضف `YOUR_GOOGLE_CLIENT_ID` في `DriveService.js`

---

## 🚀 تشغيل المشروع

```bash
# تثبيت
npm install

# تطوير (Web)
npm run dev

# تطوير (Electron)
npm run electron:dev

# بناء (Web)
npm run build

# بناء (Electron — يُنتج .exe / .dmg / .AppImage)
npm run electron:build

# Android
npm run android:sync    # بناء + مزامنة Capacitor
npm run android:open    # فتح Android Studio
```

---

## 📱 التوافق

| المنصة | الحد الأدنى |
|--------|------------|
| Chrome / Edge | 119+ (OPFS support) |
| Safari / iOS  | 17+ |
| Android       | 7+ (Capacitor) |
| Windows       | 10+ (Electron) |
| macOS         | 11+ (Electron) |

---

## 🗃 مخطط البيانات (schema.sql)

```
persons ──┬── debts ──┬── payments
          │           └── scheduled_payments
          │
budget_months ── budget_categories ── budget_expenses
                                           └── (payment_id FK → payments)
drive_sync
settings
```

الربط الذكي: `budget_expenses.payment_id` يربط مصروفة الميزانية بدفعة الدين
تلقائياً — لا إدخال مكرر.

---

## 👤 المطوّر

طُوِّر بواسطة: GT Team

</div>
