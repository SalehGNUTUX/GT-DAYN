<div align="center">
  <img src="https://raw.githubusercontent.com/SalehGNUTUX/GT-DAYN/main/icons/all/192x192/GT-DAYN-icon.png" alt="GT-DAYN Logo" width="120" height="120">
  
  # GT-DAYN
  
  ### أداة إدارة الديون والمصاريف - مفتوحة المصدر وبسيط
  
  [![الإصدار](https://img.shields.io/badge/الإصدار-1.0.0-blue.svg)](https://github.com/SalehGNUTUX/GT-DAYN/releases)
  [![الرخصة](https://img.shields.io/badge/الرخصة-GNU%20GPLv3-green.svg)](https://www.gnu.org/licenses/gpl-3.0.html)
  [![اللغة](https://img.shields.io/badge/اللغة-العربية-orange.svg)](https://github.com/SalehGNUTUX/GT-DAYN)
  
  **[عربي](#arabic) | [English](#english)**
  
  ---
  
  <a name="arabic"></a>
  ## 🇸🇦 النسخة العربية
</div>

## 📋 نظرة عامة

**GT-DAYN** هو تطبيق ويب تقدمي (PWA) لإدارة الديون والمصاريف الشخصية، مصمم خصيصاً للمستخدمين العرب. يتيح لك تتبع الديون (لك وعليك)، وإدارة الميزانية الشهرية، وتنظيم المصاريف، مع واجهة مستخدم عربية سهلة الاستخدام.

### ✨ المميزات الرئيسية

- **📊 إدارة الديون**: تتبع الديون (لي عند / عليّ) مع إمكانية إضافة دفعات وجدولة
- **👥 إدارة الأشخاص**: ملف شخصي لكل شخص مع إحصاءات الديون
- **💰 الميزانية الشهرية**: تحديد دخل شهري وفئات مصاريف مع حدود
- **📈 إحصائيات وتقارير**: رسوم بيانية وتحليلات ذكية
- **☁️ مزامنة Google Drive**: نسخ احتياطي واستعادة عبر Drive
- **🔒 أمان**: قفل التطبيق بكلمة مرور
- **🌙 الوضع المظلم**: يدعم الوضع المظلم تلقائياً حسب تفضيلات النظام
- **📱 تطبيق تقدمي (PWA)**: يعمل على جميع الأجهزة ويمكن تثبيته

## 🚀 لقطات الشاشة

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D8%AF%D9%8A%D9%88%D9%86.png?raw=true" alt="صفحة الديون" width="250">
        <br>
        <strong>صفحة الديون</strong>
      </td>
      <td align="center">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D8%A3%D8%B4%D8%AE%D8%A7%D8%B5.png?raw=true" alt="صفحة الأشخاص" width="250">
        <br>
        <strong>صفحة الأشخاص</strong>
      </td>
    </tr>
    <tr>
      <td align="center">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D9%85%D9%8A%D8%B2%D8%A7%D9%86%D9%8A%D8%A9.png?raw=true" alt="صفحة الميزانية" width="250">
        <br>
        <strong>صفحة الميزانية</strong>
      </td>
      <td align="center">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D8%A5%D8%AD%D8%B5%D8%A7%D8%A6%D9%8A%D8%A7%D8%AA.png?raw=true" alt="صفحة الإحصائيات" width="250">
        <br>
        <strong>صفحة الإحصائيات</strong>
      </td>
    </tr>
    <tr>
      <td align="center" colspan="2">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D8%A5%D8%B9%D8%AF%D8%A7%D8%AF%D8%A7%D8%AA.png?raw=true" alt="صفحة الإعدادات" width="250">
        <br>
        <strong>صفحة الإعدادات</strong>
      </td>
    </tr>
  </table>
</div>

## 💻 التثبيت والتشغيل

### المتطلبات الأساسية
- متصفح حديث (Chrome، Firefox، Safari، Edge)
- خادم ويب محلي (اختياري)

### التثبيت السريع

```bash
# استنساخ المستودع
git clone https://github.com/SalehGNUTUX/GT-DAYN.git

# الانتقال إلى المجلد
cd GT-DAYN

# تثبيت التبعيات (اختياري - للمطورين)
npm install
```

### هيكل المجلدات المطلوب

```
GT-DAYN/
├── index.html
├── manifest.json
├── fonts/
│   ├── Ubuntu Arabic Regular.otf
│   └── fontawesome/
│       ├── css/
│       │   └── all.min.css
│       └── webfonts/
├── js/
│   └── chart.umd.min.js
├── icons/
│   ├── all/
│   │   └── 192x192/
│   │       └── GT-DAYN-icon.png
│   └── favicon/
│       ├── favicon-48x48.png
│       └── favicon.ico
├── src/
│   ├── core/
│   │   └── App.js
│   └── ui/
│       ├── components/
│       │   └── ui.js
│       └── styles/
│           └── tokens.css
└── screenshot/
    ├── Screenshot_الأشخاص.png
    ├── Screenshot_الإحصائيات.png
    ├── Screenshot_الإعدادات.png
    ├── Screenshot_الديون.png
    └── Screenshot_الميزانية.png
```

### تشغيل التطبيق

1. **باستخدام خادم ويب محلي**:
```bash
# باستخدام Python
python3 -m http.server 8000

# باستخدام Node.js (إذا كان لديك serve)
npx serve

# ثم افتح المتصفح على http://localhost:8000
```

2. **مباشرة من المتصفح**:
   - افتح ملف `index.html` مباشرة في المتصفح
   - ملاحظة: بعض الميزات قد لا تعمل بدون خادم ويب

## 🛠️ الاستخدام

### إضافة دين جديد
1. اضغط على زر **"إضافة دين"** في الأسفل
2. اختر نوع الدين (لي عند / عليّ)
3. اختر الشخص أو أضف شخصاً جديداً
4. أدخل المبلغ والوصف
5. اضغط **"حفظ"**

### تسجيل دفعة
1. اضغط على بطاقة الدين
2. اضغط على زر **"تسديد"**
3. أدخل المبلغ والتاريخ
4. اضغط **"تأكيد"**

### إدارة الميزانية
1. انتقل إلى صفحة **"الميزانية"**
2. حدد الدخل الشهري
3. أضف فئات المصاريف مع حدود
4. سجل المصاريف اليومية

### النسخ الاحتياطي
- **Google Drive**: سجل الدخول لمزامنة تلقائية
- **تصدير JSON**: تصدير كامل للبيانات
- **تصدير SQLite**: قاعدة بيانات كاملة

## 🔧 التقنيات المستخدمة

- **HTML5 / CSS3**: هيكل وتصميم التطبيق
- **JavaScript (ES6+)**: منطق التطبيق
- **IndexedDB (SQL.js)**: قاعدة بيانات محلية
- **Chart.js**: الرسوم البيانية
- **Font Awesome**: الأيقونات
- **Ubuntu Arabic Font**: الخط العربي
- **Google Drive API**: المزامنة السحابية

## 🌟 المميزات التفصيلية

### 🔹 إدارة الديون
- تصنيف الديون (لي عند / عليّ)
- إضافة دفعات جزئية
- جدولة الدفعات المستقبلية
- إشعارات الدفعات المستحقة
- حساب النسبة المئوية للسداد

### 🔹 إدارة الأشخاص
- ملف شخصي لكل شخص
- إحصاءات الديون لكل شخص
- نسخ رقم الهاتف بنقرة واحدة
- مشاركة تقرير الشخص

### 🔹 الميزانية
- دخل شهري
- فئات مصاريف مع حدود
- تسجيل مصاريف يومية
- تحليل الإنفاق
- اقتراحات ذكية لسداد الديون

### 🔹 الإحصائيات
- رسوم بيانية للديون
- استراتيجيات سداد (كرة الثلج، الأولوية)
- تاريخ التحرر من الديون المتوقع

### 🔹 الإعدادات
- تغيير العملة (مع دعم 27 عملة)
- الوضع المظلم
- قفل التطبيق بكلمة مرور
- استيراد/تصدير البيانات

## 🌐 دعم العملات

يدعم التطبيق 27 عملة مختلفة تشمل:
- درهم مغربي (MAD) - افتراضي
- دينار جزائري، تونسي، ليبي
- جنيه مصري، سوداني
- ريال سعودي، درهم إماراتي
- دولار، يورو، جنيه إسترليني
- والمزيد...

## 🔒 الخصوصية والأمان

- جميع البيانات تُخزن محلياً على جهازك
- لا خوادم خارجية (عدا Google Drive بمحض إرادتك)
- تشفير بسيط لكلمة المرور
- يمكنك تصدير بياناتك في أي وقت

## 🤝 المساهمة

نرحب بمساهماتكم! للمساهمة:

1. Fork المشروع
2. أنشئ فرعاً للميزة الجديدة (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'إضافة ميزة رائعة'`)
4. Push إلى الفرع (`git push origin feature/amazing-feature`)
5. افتح Pull Request

## 📝 الترخيص

هذا المشروع مرخص تحت **GNU General Public License v3.0** - انظر ملف [LICENSE](LICENSE) للتفاصيل.

## 📧 التواصل

- GitHub: [@SalehGNUTUX](https://github.com/SalehGNUTUX)
- المشروع: [GT-DAYN](https://github.com/SalehGNUTUX/GT-DAYN)

## 🙏 الشكر

- [Font Awesome](https://fontawesome.com) - للأيقونات الرائعة
- [Chart.js](https://www.chartjs.org) - للرسوم البيانية
- [SQL.js](https://sql.js.org) - لقاعدة البيانات المحلية
- [Ubuntu Font](https://design.ubuntu.com/font) - للخط العربي الجميل

---

<div align="center">
  <strong>GT-DAYN</strong> - إدارة الديون والمصاريف ببساطة
  <br>
  <sub>مشروع مفتوح المصدر بروح المجتمع العربي</sub>
</div>

---

<a name="english"></a>
## 🇬🇧 English Version

# 📁 GT-DAYN

### Debt & Expense Management Tool - Open Source & Simple

## 📋 Overview

**GT-DAYN** is a Progressive Web App (PWA) for managing personal debts and expenses, specifically designed for Arabic users. Track debts (owed to you and by you), manage monthly budgets, organize expenses, with an easy-to-use Arabic interface.

## ✨ Key Features

- **📊 Debt Management**: Track debts (receivable/payable) with payment scheduling
- **👥 People Management**: Personal profiles for each person with debt statistics
- **💰 Monthly Budget**: Set monthly income and expense categories with limits
- **📈 Statistics & Reports**: Charts and smart analytics
- **☁️ Google Drive Sync**: Backup and restore via Drive
- **🔒 Security**: App lock with password
- **🌙 Dark Mode**: Automatic dark mode based on system preferences
- **📱 PWA**: Works on all devices, installable

## 🚀 Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D8%AF%D9%8A%D9%88%D9%86.png?raw=true" alt="Debts Page" width="250">
        <br>
        <strong>Debts Page</strong>
      </td>
      <td align="center">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D8%A3%D8%B4%D8%AE%D8%A7%D8%B5.png?raw=true" alt="People Page" width="250">
        <br>
        <strong>People Page</strong>
      </td>
    </tr>
    <tr>
      <td align="center">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D9%85%D9%8A%D8%B2%D8%A7%D9%86%D9%8A%D8%A9.png?raw=true" alt="Budget Page" width="250">
        <br>
        <strong>Budget Page</strong>
      </td>
      <td align="center">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D8%A5%D8%AD%D8%B5%D8%A7%D8%A6%D9%8A%D8%A7%D8%AA.png?raw=true" alt="Statistics Page" width="250">
        <br>
        <strong>Statistics Page</strong>
      </td>
    </tr>
    <tr>
      <td align="center" colspan="2">
        <img src="https://github.com/SalehGNUTUX/GT-DAYN/blob/main/screenshot/Screenshot_%D8%A7%D9%84%D8%A5%D8%B9%D8%AF%D8%A7%D8%AF%D8%A7%D8%AA.png?raw=true" alt="Settings Page" width="250">
        <br>
        <strong>Settings Page</strong>
      </td>
    </tr>
  </table>
</div>

## 💻 Installation

```bash
# Clone repository
git clone https://github.com/SalehGNUTUX/GT-DAYN.git

# Navigate to folder
cd GT-DAYN

# Run with Python server
python3 -m http.server 8000
```

## 📝 License

This project is licensed under the **GNU General Public License v3.0**.

## 📧 Contact

- GitHub: [@SalehGNUTUX](https://github.com/SalehGNUTUX)
- Project: [GT-DAYN](https://github.com/SalehGNUTUX/GT-DAYN)

---

<div align="center">
  <strong>GT-DAYN</strong> - Manage debts and expenses simply
  <br>
  <sub>Open source project with Arab community spirit</sub>
</div>
