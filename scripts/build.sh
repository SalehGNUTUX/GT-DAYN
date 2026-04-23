#!/bin/bash
# ═════════════════════════════════════════════════════════════════
# GT-DAYN Build Script - بناء شامل لجميع المنصات
# ═════════════════════════════════════════════════════════════════

set -e

# الألوان
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# المسارات
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
BUILD_DIR="$PROJECT_DIR/build"
ICONS_DIR="$PROJECT_DIR/public/icons"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  GT-DAYN Build Script v1.1.0${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# التحقق من وجود Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ خطأ: Node.js غير مثبت${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Node.js version: $(node --version)${NC}"
echo ""

# ═════════════════════════════════════════════════════════════════
# الخطوة 1: تجهيز المجلدات
# ═════════════════════════════════════════════════════════════════
echo -e "${YELLOW}📁 تجهيز مجلدات البناء...${NC}"
mkdir -p "$BUILD_DIR"
mkdir -p "$ICONS_DIR"
echo -e "${GREEN}✓ تم تجهيز المجلدات${NC}"
echo ""

# ═════════════════════════════════════════════════════════════════
# الخطوة 2: نسخ الأيقونة الرسمية
# ═════════════════════════════════════════════════════════════════
echo -e "${YELLOW}🎨 نسخ الأيقونة الرسمية...${NC}"

# البحث عن الأيقونة في dist/assets
FAVICON_SRC=""
for f in "$DIST_DIR/assets/"favicon*.ico; do
    if [ -f "$f" ]; then
        FAVICON_SRC="$f"
        break
    fi
done

if [ -n "$FAVICON_SRC" ]; then
    # نسخ الأيقونة بأحجام مختلفة
    cp "$FAVICON_SRC" "$ICONS_DIR/favicon.ico"
    
    # إنشاء نسخ PNG إذا كان ImageMagick متاحاً
    if command -v convert &> /dev/null; then
        convert "$FAVICON_SRC" -resize 16x16 "$ICONS_DIR/icon-16x16.png"
        convert "$FAVICON_SRC" -resize 32x32 "$ICONS_DIR/icon-32x32.png"
        convert "$FAVICON_SRC" -resize 48x48 "$ICONS_DIR/favicon-48x48.png"
        convert "$FAVICON_SRC" -resize 128x128 "$ICONS_DIR/icon-128x128.png"
        convert "$FAVICON_SRC" -resize 256x256 "$ICONS_DIR/icon-256x256.png"
        convert "$FAVICON_SRC" -resize 512x512 "$ICONS_DIR/icon-512x512.png"
        echo -e "${GREEN}✓ تم إنشاء الأيقونات بجميع الأحجام${NC}"
    else
        echo -e "${YELLOW}⚠ ImageMagick غير متوفر، تم نسخ الأيقونة فقط${NC}"
    fi
    
    echo -e "${GREEN}✓ الأيقونة: $(basename "$FAVICON_SRC")${NC}"
else
    echo -e "${YELLOW}⚠ لم يُعثر على الأيقونة في dist/assets/${NC}"
fi
echo ""

# ═════════════════════════════════════════════════════════════════
# الخطوة 3: بناء المشروع
# ═════════════════════════════════════════════════════════════════
echo -e "${YELLOW}🔨 بناء المشروع (npm run build)...${NC}"
cd "$PROJECT_DIR"
npm run build
echo -e "${GREEN}✓ تم بناء المشروع${NC}"
echo ""

# ═════════════════════════════════════════════════════════════════
# الخطوة 4: بناء Linux AppImage
# ═════════════════════════════════════════════════════════════════
build_linux() {
    echo -e "${YELLOW}🐧 بناء نسخة Linux (AppImage)...${NC}"
    
    # التحقق من وجود electron-builder
    if [ ! -d "node_modules/electron-builder" ]; then
        echo -e "${YELLOW}⚠ تثبيت electron-builder...${NC}"
        npm install --save-dev electron-builder
    fi
    
    # بناء AppImage
    npm run electron:linux
    
    # نقل الناتج إلى مجلد build
    for f in dist-electron/*.AppImage; do
        if [ -f "$f" ]; then
            cp "$f" "$BUILD_DIR/"
            echo -e "${GREEN}✓ تم إنشاء: $(basename "$f")${NC}"
        fi
    done
}

# ═════════════════════════════════════════════════════════════════
# الخطوة 5: بناء Windows
# ═════════════════════════════════════════════════════════════════
build_windows() {
    echo -e "${YELLOW}🪟 بناء نسخة Windows...${NC}"
    
    # التحقق من وجود Wine (للبناء عبر Linux)
    if ! command -v wine &> /dev/null; then
        echo -e "${YELLOW}⚠ Wine غير متوفر، سيتم تخطي توقيع Windows${NC}"
    fi
    
    # بناء Windows
    npm run electron:win || echo -e "${YELLOW}⚠ فشل بناء Windows (قد يحتاج Windows)${NC}"
    
    # نقل الناتج
    for f in dist-electron/*.exe dist-electron/*.msi; do
        if [ -f "$f" ]; then
            cp "$f" "$BUILD_DIR/"
            echo -e "${GREEN}✓ تم إنشاء: $(basename "$f")${NC}"
        fi
    done
}

# ═════════════════════════════════════════════════════════════════
# الخطوة 6: بناء Android APK
# ═════════════════════════════════════════════════════════════════
build_android() {
    echo -e "${YELLOW}📱 بناء نسخة Android (APK)...${NC}"
    
    # التحقق من وجود Android SDK
    if [ -d "android" ]; then
        npm run android:apk || {
            echo -e "${YELLOW}⚠ فشل بناء APK، تأكد من تثبيت Android SDK${NC}"
            return 1
        }
        
        # نقل APK
        for f in android/app/build/outputs/apk/debug/*.apk; do
            if [ -f "$f" ]; then
                cp "$f" "$BUILD_DIR/"
                echo -e "${GREEN}✓ تم إنشاء: $(basename "$f")${NC}"
            fi
        done
    else
        echo -e "${YELLOW}⚠ مجلد Android غير موجود، تخطي البناء${NC}"
    fi
}

# ═════════════════════════════════════════════════════════════════
# تنفيذ البناء حسب المعاملات
# ═════════════════════════════════════════════════════════════════
if [ $# -eq 0 ]; then
    # بناء الكل
    echo -e "${BLUE}🚀 بناء جميع المنصات...${NC}"
    echo ""
    build_linux
    build_windows
    build_android
else
    case "$1" in
        linux)
            build_linux
            ;;
        windows|win)
            build_windows
            ;;
        android|apk)
            build_android
            ;;
        web)
            echo -e "${GREEN}✓ تم بناء نسخة الويب في $DIST_DIR${NC}"
            ;;
        *)
            echo -e "${RED}❌ استخدام: $0 [linux|windows|android|web]${NC}"
            echo -e "   أو بدون معاملات لبناء الكل"
            exit 1
            ;;
    esac
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ اكتمل البناء بنجاح!${NC}"
echo -e "${BLUE}📂 الملفات في: $BUILD_DIR${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# عرض الملفات المنشأة
echo ""
echo "📦 الملفات المنشأة:"
ls -lh "$BUILD_DIR/" 2>/dev/null || echo "  (مجلد البناء فارغ)"
