#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# GT-DAYN — بناء AppImage لـ Linux — v1.0.2
# ═══════════════════════════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
S=0; T=6; E=0

step() { S=$((S+1)); echo ""; echo -e "${BLUE}══ [$S/$T] $1 ══${NC}"; }
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
err()  { echo -e "${RED}  ✗ $1${NC}"; E=1; }
info() { echo -e "${CYAN}  ℹ $1${NC}"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   GT-DAYN — بناء AppImage تلقائي            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
cd "$PROJECT_DIR"
info "مجلد المشروع: $PROJECT_DIR"

step "تثبيت المكتبات"
npm install
ok "npm install"

step "التحقق من الأيقونات"
if [ ! -f "public/icons/icon.png" ]; then
  [ -f "icons/all/512x512/GT-DAYN-icon.png" ] && cp "icons/all/512x512/GT-DAYN-icon.png" "public/icons/icon.png" && ok "icon.png منسوخة"
else
  ok "public/icons/icon.png موجودة"
fi
[ -f "icons/GT-DAYN-icon.ico" ]  && cp "icons/GT-DAYN-icon.ico"  "public/icons/icon.ico"
[ -f "icons/GT-DAYN-icon.icns" ] && cp "icons/GT-DAYN-icon.icns" "public/icons/icon.icns"

step "بناء ملفات الويب"
npm run build
ok "vite build"

step "بناء AppImage"
npm run electron:linux
ok "electron-builder"

step "نسخ الناتج"
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.1")
APPIMAGE=$(find dist-electron -name "*.AppImage" 2>/dev/null | head -1)
mkdir -p build
if [ -n "$APPIMAGE" ]; then
  cp "$APPIMAGE" "build/GT-DAYN-${VERSION}-linux-x86_64.AppImage"
  chmod +x "build/GT-DAYN-${VERSION}-linux-x86_64.AppImage"
  SIZE=$(du -h "build/GT-DAYN-${VERSION}-linux-x86_64.AppImage" | cut -f1)
  ok "build/GT-DAYN-${VERSION}-linux-x86_64.AppImage ($SIZE)"
else
  err "لم يُوجَد ملف AppImage"
fi

step "التقرير النهائي"
echo ""
echo -e "${BLUE}══════════════════════════════════════════${NC}"
if [ $E -eq 0 ]; then
  echo -e "${GREEN}  ✅ AppImage جاهزة في: build/${NC}"
  echo -e "${YELLOW}  للتشغيل:${NC}"
  echo -e "    chmod +x build/GT-DAYN-*-linux-x86_64.AppImage"
  echo -e "    ./build/GT-DAYN-*-linux-x86_64.AppImage"
else
  echo -e "${RED}  ❌ فشل البناء${NC}"
fi
echo -e "${BLUE}══════════════════════════════════════════${NC}"
exit $E
