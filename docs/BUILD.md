# دليل بناء GT-DAYN v1.0.0

## المتطلبات

| الأداة | الإصدار |
|--------|---------|
| Node.js | ≥ 18    |
| npm     | ≥ 9     |
| Git     | أي      |

```bash
git clone https://github.com/SalehGNUTUX/GT-DAYN.git
cd GT-DAYN
npm install
```

---

## Linux — AppImage

```bash
npm run electron:linux
# dist-electron/GT-DAYN-1.0.0-linux-x86_64.AppImage

chmod +x dist-electron/GT-DAYN-*.AppImage
./dist-electron/GT-DAYN-*.AppImage
```

---

## Windows — EXE/NSIS

**من نظام Windows مباشرة (موصى به):**
```cmd
npm install
npm run electron:win
# dist-electron\GT-DAYN Setup 1.0.0.exe
```

**من Linux (بدون توقيع):**
```bash
# تثبيت wine أولاً:
sudo apt install wine64   # أو: sudo dnf install wine
npm run electron:win
```

---

## Android — APK

المتطلبات الإضافية: Android Studio + JDK 17+

```bash
npm run android:init   # مرة واحدة فقط
npm run android:apk

# APK في:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## ملاحظات التقنية

- **لا native modules** — يستخدم `sql.js` (Pure JS/WASM) على جميع المنصات
- **لا توقيع رقمي** — الإصدار 1.0.0 بدون code signing
- الأيقونات مطلوبة في `public/icons/`:
  - `icon.png`  (512×512) — Linux + Android
  - `icon.ico`  (متعدد) — Windows
