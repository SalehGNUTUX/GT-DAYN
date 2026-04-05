#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# GT-DAYN — سكريبت بناء شامل لجميع المنصات
# الإصدار: 1.0.1
# ═══════════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   GT-DAYN — بناء شامل v1.0.1                   ║${NC}"
echo -e "${CYAN}║   All Platforms Build Script                    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_DIR"
mkdir -p build

# تحديد ما يُبنى
BUILD_LINUX=0; BUILD_ANDROID=0; BUILD_WIN=0

if [ "$#" -eq 0 ]; then
    BUILD_LINUX=1; BUILD_ANDROID=1
else
    for arg in "$@"; do
        case "$arg" in
            linux)   BUILD_LINUX=1 ;;
            android) BUILD_ANDROID=1 ;;
            win)     BUILD_WIN=1 ;;
            all)     BUILD_LINUX=1; BUILD_ANDROID=1; BUILD_WIN=1 ;;
        esac
    done
fi

RESULTS=()

# ── بناء Linux AppImage ────────────────────────────────────────────────────────
if [ $BUILD_LINUX -eq 1 ]; then
    echo -e "${BLUE}══ بناء Linux AppImage ══${NC}"
    if bash "$SCRIPT_DIR/build-linux.sh"; then
        RESULTS+=("✅ Linux AppImage: build/GT-DAYN-*-linux-x86_64.AppImage")
    else
        RESULTS+=("❌ Linux AppImage: فشل البناء")
    fi
fi

# ── بناء Android APK ──────────────────────────────────────────────────────────
if [ $BUILD_ANDROID -eq 1 ]; then
    echo -e "${BLUE}══ بناء Android APK ══${NC}"
    if bash "$SCRIPT_DIR/build-android.sh" "${2:-debug}"; then
        RESULTS+=("✅ Android APK: build/GT-DAYN-*.apk")
    else
        RESULTS+=("❌ Android APK: فشل البناء")
    fi
fi

# ── بناء Windows EXE ──────────────────────────────────────────────────────────
if [ $BUILD_WIN -eq 1 ]; then
    echo -e "${BLUE}══ بناء Windows EXE ══${NC}"
    if npm run electron:win; then
        VERSION=$(node -p "require('./package.json').version")
        cp dist-electron/*.exe "build/" 2>/dev/null || true
        RESULTS+=("✅ Windows EXE: build/")
    else
        RESULTS+=("❌ Windows EXE: فشل (يحتاج wine أو Windows)")
    fi
fi

# ── التقرير النهائي ────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  تقرير البناء النهائي${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
for result in "${RESULTS[@]}"; do echo -e "  $result"; done
echo ""
echo -e "${YELLOW}  الملفات الناتجة:${NC}"
ls -lh build/ 2>/dev/null || echo "  (لا ملفات)"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""
