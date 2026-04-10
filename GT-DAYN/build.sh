#!/bin/bash
# GT-DAYN Build Script - تجهيز الأيقونات والبناء
# هذا السكربت يجهز الأيقونات من المصدر إلى المجلدات المطلوبة قبل البناء

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICONS_DIR="$SCRIPT_DIR/icons"
FAVICON_DIR="$ICONS_DIR/favicon"
ALL_ICONS_DIR="$ICONS_DIR/all"

echo "🔨 GT-DAYN Build Script"
echo "======================"

# التحقق من وجود ملف الأيقونة الأصلي
SOURCE_ICON="$ICONS_DIR/GT-DAYN-icon.ico"
if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ خطأ: لم يُعثر على ملف الأيقونة الأصلي: $SOURCE_ICON"
    exit 1
fi

echo "✅ ملف الأيقونة الأصلي موجود: $SOURCE_ICON"

# إنشاء مجلد favicon إذا لم يكن موجوداً
if [ ! -d "$FAVICON_DIR" ]; then
    echo "📁 إنشاء مجلد favicon..."
    mkdir -p "$FAVICON_DIR"
fi

# نسخ favicon.ico إلى مجلد favicon
echo "📋 نسخ favicon.ico إلى مجلد favicon..."
cp "$SOURCE_ICON" "$FAVICON_DIR/favicon.ico"

# نسخ favicon-DAHE5TBf.ico إذا كان موجوداً (للتوافق مع Vite build)
DAHE_SOURCE="$SCRIPT_DIR/dist/assets/favicon-DAHE5TBf.ico"
if [ -f "$DAHE_SOURCE" ]; then
    echo "📋 نسخ favicon-DAHE5TBf.ico إلى مجلد favicon..."
    cp "$DAHE_SOURCE" "$FAVICON_DIR/favicon-DAHE5TBf.ico"
fi

# التحقق من وجود مجلد all للأيقونات بجميع الأحجام
if [ ! -d "$ALL_ICONS_DIR" ]; then
    echo "📁 إنشاء مجلد all للأيقونات..."
    mkdir -p "$ALL_ICONS_DIR"
fi

# إنشاء أحجام الأيقونات المطلوبة (إذا كان ImageMagick متاحاً)
if command -v convert &> /dev/null; then
    echo "🎨 إنشاء الأيقونات بأحجام مختلفة..."
    
    # أحجام الأيقونات للـ PWA و Android
    SIZES=("192x192" "512x512" "48x48" "72x72" "96x96" "144x144")
    
    for size in "${SIZES[@]}"; do
        SIZE_ICON="$ALL_ICONS_DIR/GT-DAYN-icon-${size}.png"
        if [ ! -f "$SIZE_ICON" ]; then
            echo "  - إنشاء أيقونة ${size}..."
            convert "$ICONS_DIR/GT-DAYN-icon-original.png" -resize "$size" "$SIZE_ICON" 2>/dev/null || echo "    ⚠️ تعذر إنشاء ${size}"
        fi
    done
    
    # إنشاء favicon.ico من PNG إذا لم يكن موجوداً
    if [ ! -f "$FAVICON_DIR/favicon.ico" ]; then
        convert "$ICONS_DIR/GT-DAYN-icon-original.png" -resize 32x32 "$FAVICON_DIR/favicon.ico"
    fi
else
    echo "⚠️ ImageMagick غير مثبت - نسخ الأيقونات الأساسية فقط"
    
    # نسخ الأيقونة الأصلية إلى مجلد all
    if [ -f "$ICONS_DIR/GT-DAYN-icon-original.png" ]; then
        cp "$ICONS_DIR/GT-DAYN-icon-original.png" "$ALL_ICONS_DIR/GT-DAYN-icon-192x192.png" 2>/dev/null || true
        cp "$ICONS_DIR/GT-DAYN-icon-original.png" "$ALL_ICONS_DIR/GT-DAYN-icon-512x512.png" 2>/dev/null || true
    fi
fi

# التحقق من الملفات المطلوبة
echo ""
echo "📋 التحقق من الملفات المطلوبة:"

REQUIRED_FILES=(
    "$FAVICON_DIR/favicon.ico"
    "$FAVICON_DIR/favicon-48x48.png"
    "$ALL_ICONS_DIR/192x192/GT-DAYN-icon.png"
)

# إنشاء مجلد 192x192 إذا لزم الأمر
mkdir -p "$ALL_ICONS_DIR/192x192"

# نسخ الأيقونة 192x192
if [ -f "$ALL_ICONS_DIR/GT-DAYN-icon-192x192.png" ]; then
    cp "$ALL_ICONS_DIR/GT-DAYN-icon-192x192.png" "$ALL_ICONS_DIR/192x192/GT-DAYN-icon.png"
fi

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $(basename "$file")"
    else
        echo "  ⚠️ مفقود: $(basename "$file")"
    fi
done

echo ""
echo "✅ اكتمل تجهيز الأيقونات!"
echo ""

# بدء البناء إذا طُلب
if [ "$1" == "--build" ] || [ "$1" == "-b" ]; then
    echo "🚀 بدء البناء..."
    
    if [ -f "package.json" ]; then
        npm run build
    else
        echo "❌ ملف package.json غير موجود"
        exit 1
    fi
fi

echo ""
echo "📁 بنية المجلدات النهائية:"
echo "  icons/"
echo "  ├── favicon/"
echo "  │   └── favicon.ico ✓"
echo "  ├── all/"
echo "  │   ├── 192x192/"
echo "  │   │   └── GT-DAYN-icon.png ✓"
echo "  │   └── GT-DAYN-icon-{size}.png"
echo "  └── GT-DAYN-icon.ico (المصدر)"
echo ""
echo "✨ جاهز للبناء!"
