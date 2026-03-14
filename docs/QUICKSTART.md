# GT-DAYN — دليل البدء السريع

## 1. تشغيل النسخة الويب (PWA)

```bash
npm install
npm run dev
# افتح: http://localhost:5173
```

لبناء نسخة إنتاج:
```bash
npm run build
# المخرجات في: dist/
```

---

## 2. نسخة سطح المكتب (Electron)

```bash
# تثبيت التبعيات الإضافية
npm install --save-dev electron electron-builder better-sqlite3 concurrently wait-on

# تشغيل للتطوير
npm run electron:dev

# بناء مُثبِّت (.exe / .dmg / .AppImage)
npm run electron:build
```

المخرجات في `dist-electron/`.

---

## 3. نسخة Android (Capacitor)

```bash
# 1. تثبيت Capacitor
npm install @capacitor/core @capacitor/cli @capacitor-community/sqlite

# 2. بناء الويب أولاً
npm run build

# 3. إضافة منصة Android
npm run android:add

# 4. مزامنة الملفات
npm run android:sync

# 5. فتح Android Studio
npm run android:open
# ثم اضغط Run ▶ في Android Studio
```

---

## 4. إعداد Google Drive

1. اذهب إلى [console.cloud.google.com](https://console.cloud.google.com/)
2. مشروع جديد → فعّل **Google Drive API**
3. Credentials → OAuth 2.0 Client ID → Web Application
4. أضف نطاقك في Authorized JavaScript origins
5. انسخ الـ Client ID وضعه في:

```js
// src/core/services/DriveService.js
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

6. أضف في HTML:
```html
<script src="https://accounts.google.com/gsi/client" async></script>
```

---

## 5. هيكل الملفات المهمة

| الملف | الوصف |
|-------|-------|
| `src/core/db/schema.sql` | مخطط SQLite الموحد |
| `src/core/db/WebSQLiteAdapter.js` | تخزين المتصفح |
| `src/core/services/DebtService.js` | منطق الديون |
| `src/core/services/BudgetService.js` | منطق الميزانية |
| `src/core/services/DriveService.js` | مزامنة Drive |
| `src/core/db/migrate.js` | ترحيل البيانات القديمة |
| `platforms/web/index.html` | الواجهة الكاملة |
| `platforms/electron/main.js` | Electron Main Process |
| `platforms/android/capacitor.config.ts` | إعدادات Android |

---

## 6. أول تشغيل

عند أول تشغيل، يتحقق التطبيق من وجود بيانات قديمة في `localStorage`
(مفتاح `my_debts_final_v3`) ويرحّلها تلقائياً إلى SQLite.
