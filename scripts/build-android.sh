#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# GT-DAYN — بناء APK لـ Android — v1.0.2
# يُثبّت المكتبات تلقائياً ويُطبّق الأيقونات الرسمية
# ═══════════════════════════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
S=0; T=9; E=0

step() { S=$((S+1)); echo ""; echo -e "${BLUE}══════════════════════════════════════════════${NC}"; echo -e "${BLUE}  [$S/$T] $1${NC}"; echo -e "${BLUE}══════════════════════════════════════════════${NC}"; }
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
err()  { echo -e "${RED}  ✗ فشل: $1${NC}"; E=1; }
info() { echo -e "${CYAN}  ℹ $1${NC}"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   GT-DAYN — بناء APK تلقائي  v1.0.2        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
cd "$PROJECT_DIR"
info "مجلد المشروع: $PROJECT_DIR"

# فحص ANDROID_HOME
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  for sdk in "$HOME/Android/Sdk" "$HOME/.android/sdk" "/opt/android-sdk"; do
    [ -d "$sdk" ] && { export ANDROID_HOME="$sdk"; ok "ANDROID_HOME: $sdk"; break; }
  done
fi

step "تثبيت المكتبات"
npm install
ok "npm install"

step "بناء ملفات الويب"
npm run build
ok "vite build"

step "نسخ sql.js للعمل أوفلاين"
[ -f "node_modules/sql.js/dist/sql-wasm.js" ] && {
  cp node_modules/sql.js/dist/sql-wasm.js   dist/sql-wasm.js
  cp node_modules/sql.js/dist/sql-wasm.wasm dist/sql-wasm.wasm
  ok "sql-wasm → dist/"
} || true

step "إعداد منصة Android"
if [ ! -d "android" ]; then
  npx cap add android; ok "android platform added"
else
  ok "مجلد android موجود"
fi

step "مزامنة Capacitor"
npx cap sync android
ok "cap sync"

step "تطبيق الأيقونات الرسمية (جميع الأحجام)"
ANDROID_RES="android/app/src/main/res"
SOURCE_RES="$PROJECT_DIR/android-res"

if [ -d "$SOURCE_RES" ] && [ -d "$ANDROID_RES" ]; then
  # نسخ كل محتوى android-res إلى res الأندرويد
  cp -r "$SOURCE_RES"/. "$ANDROID_RES/"
  ok "android-res → $ANDROID_RES (جميع المجلدات والأحجام)"

  # أيضاً نسخ من icons/all للمجلدات mipmap بالأحجام الصحيحة
  declare -A MIPMAP_SIZES=(
    ["mipmap-ldpi"]="36x36"
    ["mipmap-mdpi"]="48x48"
    ["mipmap-hdpi"]="72x72"
    ["mipmap-xhdpi"]="96x96"
    ["mipmap-xxhdpi"]="144x144"
    ["mipmap-xxxhdpi"]="192x192"
  )
  for folder in "${!MIPMAP_SIZES[@]}"; do
    size="${MIPMAP_SIZES[$folder]}"
    src="icons/all/${size}/GT-DAYN-icon.png"
    dst="$ANDROID_RES/$folder/ic_launcher.png"
    if [ -f "$src" ]; then
      cp "$src" "$dst"
      cp "$src" "$ANDROID_RES/$folder/ic_launcher_round.png" 2>/dev/null || true
      cp "$src" "$ANDROID_RES/$folder/ic_launcher_foreground.png" 2>/dev/null || true
    fi
  done
  ok "أيقونات mipmap محدّثة بالأحجام الصحيحة"
else
  [ ! -d "$SOURCE_RES" ] && echo -e "${YELLOW}  ⚠ android-res غير موجود${NC}"
  [ ! -d "$ANDROID_RES" ] && echo -e "${YELLOW}  ⚠ android/app/src/main/res غير موجود${NC}"
fi

step "بناء APK"
BUILD_TYPE="${1:-debug}"
cd android
chmod +x gradlew 2>/dev/null || true
if [ "$BUILD_TYPE" = "release" ]; then
  ./gradlew assembleRelease
  APK_RELATIVE="app/build/outputs/apk/release/app-release-unsigned.apk"
else
  ./gradlew assembleDebug
  APK_RELATIVE="app/build/outputs/apk/debug/app-debug.apk"
fi
cd ..

step "حفظ APK"
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.1")
mkdir -p build
if [ -f "android/$APK_RELATIVE" ]; then
  OUTPUT="build/GT-DAYN-${VERSION}.apk"
  cp "android/$APK_RELATIVE" "$OUTPUT"
  SIZE=$(du -h "$OUTPUT" | cut -f1)
  ok "الملف: $OUTPUT ($SIZE)"
else
  err "لم يُوجَد APK في: android/$APK_RELATIVE"
fi

echo ""
echo -e "${BLUE}══════════════════════════════════════════════${NC}"
[ $E -eq 0 ] && {
  echo -e "${GREEN}  ✅ APK جاهز في: build/${NC}"
  echo -e "${YELLOW}  للتثبيت: adb install build/GT-DAYN-${VERSION}.apk${NC}"
} || echo -e "${RED}  ❌ فشل البناء — راجع الأخطاء أعلاه${NC}"
echo -e "${BLUE}══════════════════════════════════════════════${NC}"
echo ""
exit $E
