# GT-DAYN-icons

أُنشئت بواسطة **GT-IconScaler v2.0** — 2026-03-13 14:35

## هيكل المجلدات

```
GT-DAYN-icons/
├── all/            ← جميع المقاسات (14 مقاساً)
├── linux/          ← hicolor XDG (16→512)
├── pwa/            ← Web Manifest + Apple Touch
├── android/        ← mipmap-ldpi → mipmap-xxxhdpi
├── ios/            ← App Icon (20→1024)
├── electron/       ← AppImage / Snap (16→1024)
├── favicon/        ← favicon.ico + PNG
├── GT-DAYN-icon.ico    ← Windows (متعدد الأحجام)
└── GT-DAYN-icon.icns   ← macOS (إن توفّر)
```

## المقاسات المُصدَّرة

| المقاس | الاستخدام |
|--------|-----------|
| 16 | Linux تبار · Favicon · Electron |
| 20 | iOS Notification |
| 22 | Linux GNOME/KDE صغير |
| 24 | Linux شريط القوائم |
| 29 | iOS Settings |
| 32 | Linux · Favicon · Windows ICO · Electron |
| 36 | Android ldpi |
| 40 | iOS Spotlight |
| 48 | Linux قياسي · Android mdpi |
| 58 | iOS Settings @2x |
| 60 | iOS App @1x |
| 64 | Linux · Electron |
| 72 | Android hdpi · PWA |
| 76 | iPad App |
| 80 | iOS Spotlight @2x |
| 87 | iOS Settings @3x |
| 96 | Linux · Android xhdpi |
| 120 | iOS App @2x |
| 128 | Linux · Electron · Windows ICO |
| 144 | Android xxhdpi · PWA |
| 152 | iPad App @2x · PWA |
| 167 | iPad Pro |
| 180 | iPhone App @3x · Apple Touch Icon |
| 192 | PWA Install Required · Android xxxhdpi |
| 256 | Linux · Electron · Windows ICO |
| 384 | PWA Splash |
| 512 | Linux · PWA Required · Electron |
| 1024 | iOS App Store · Electron |

## الاستخدام

### PWA manifest.json
```json
"icons": [
  { "src": "pwa/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "pwa/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "pwa/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
]
```

### Android (res/mipmap-*)
انسخ المحتوى من `android/` إلى `app/src/main/res/`

### Electron (package.json)
```json
"linux": { "icon": "electron/" }
```
