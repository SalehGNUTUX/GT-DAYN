# أيقونات GT-DAYN

ضع الأيقونات في هذا المجلد بالأسماء التالية:

| الملف | الحجم | الاستخدام |
|-------|-------|----------|
| `icon.png`  | 512×512 PNG | Linux AppImage + Android |
| `icon.ico`  | متعدد الأحجام | Windows NSIS installer |
| `icon.icns` | متعدد الأحجام | macOS DMG (اختياري) |

## إنشاء من ملف PNG واحد

```bash
npm install -g electron-icon-builder
electron-icon-builder --input=icon.png --output=./
```
