# البدء السريع / Quick Start Guide

دليل سريع لتشغيل نظام محاسبة التوريدات والنقل
Quick guide to run the Deliveries & Transport Accounting System

## المتطلبات السريعة / Quick Requirements

- Node.js 18+ ✅
- npm أو yarn ✅
- متصفح ويب حديث ✅

## التثبيت السريع / Quick Installation

### 1. تثبيت التبعيات / Install Dependencies
```bash
npm install
```

### 2. إنشاء المجلدات / Create Directories
```bash
mkdir -p data uploads logs
```

### 3. نسخ ملف البيئة / Copy Environment File
```bash
cp env.example .env
```

### 4. تشغيل قاعدة البيانات / Setup Database
```bash
npm run migrate
npm run seed
```

### 5. تشغيل التطبيق / Start Application
```bash
npm run dev
```

### 6. فتح المتصفح / Open Browser
```
http://localhost:3000
```

## الحسابات التجريبية / Demo Accounts

| الدور | البريد الإلكتروني | كلمة المرور |
|-------|-------------------|-------------|
| مدير | manager@company.com | password123 |
| محاسب | accountant@company.com | password123 |
| مدقق | auditor@company.com | password123 |

## الميزات الأساسية / Core Features

### 📊 لوحة التحكم / Dashboard
- إحصائيات فورية للتوريدات
- رسوم بيانية للموردين
- النشاط الشهري

### 📁 استيراد Excel / Excel Import
- رفع ملفات .xlsx, .xls, .csv
- اكتشاف تلقائي للأعمدة
- معاينة البيانات قبل الاستيراد
- معالجة الصيغ تلقائياً

### 📋 إدارة التوريدات / Delivery Management
- إضافة/تعديل/حذف التوريدات
- بحث متقدم مع فلاتر
- حساب تلقائي للحقول المعتمدة

### 📈 التقارير / Reports
- تقارير ملخصة
- تقارير التوريدات التفصيلية
- تصدير البيانات

## استكشاف الأخطاء / Troubleshooting

### مشكلة في قاعدة البيانات / Database Issues
```bash
# إعادة تشغيل قاعدة البيانات
npm run migrate:rollback
npm run migrate
npm run seed
```

### مشكلة في التبعيات / Dependency Issues
```bash
# حذف وإعادة تثبيت التبعيات
rm -rf node_modules package-lock.json
npm install
```

### مشكلة في المنفذ / Port Issues
```bash
# تغيير المنفذ في ملف .env
PORT=3001
```

### مشكلة في الصلاحيات / Permission Issues
```bash
# إعطاء صلاحيات للمجلدات
chmod 755 data uploads logs
```

## الأوامر المفيدة / Useful Commands

```bash
# تشغيل في وضع التطوير
npm run dev

# تشغيل في وضع الإنتاج
npm start

# تشغيل الاختبارات
npm test

# تشغيل الاختبارات مع المراقبة
npm run test:watch

# تشغيل الهجرات
npm run migrate

# إعادة تشغيل الهجرات
npm run migrate:rollback

# إضافة البيانات التجريبية
npm run seed
```

## هيكل المشروع السريع / Quick Project Structure

```
deliveries-transport-accounting/
├── server/                 # Backend
│   ├── routes/            # API Routes
│   ├── services/          # Business Logic
│   ├── migrations/        # Database Changes
│   └── seeds/             # Sample Data
├── client/public/          # Frontend
│   ├── index.html         # Main Page
│   ├── styles.css         # Styling
│   └── app.js             # Frontend Logic
├── data/                   # Database Files
├── uploads/                # File Uploads
└── logs/                   # Application Logs
```

## API Endpoints السريعة / Quick API Endpoints

### المصادقة / Authentication
- `POST /api/auth/login` - تسجيل الدخول
- `GET /api/auth/me` - معلومات المستخدم

### التوريدات / Deliveries
- `GET /api/deliveries` - قائمة التوريدات
- `POST /api/deliveries` - إضافة توريد
- `PUT /api/deliveries/:id` - تحديث توريد

### الاستيراد / Import
- `POST /api/import/excel` - رفع ملف Excel
- `POST /api/import/process` - معالجة الاستيراد

### التقارير / Reports
- `GET /api/reports/summary` - تقرير ملخص
- `GET /api/reports/deliveries` - تقرير التوريدات

## مثال سريع للاستيراد / Quick Import Example

### 1. إنشاء ملف Excel بسيط / Create Simple Excel File
| التاريخ | المورد | الحجم | السعر | القيمة |
|---------|--------|-------|-------|--------|
| 2024-01-01 | مورد الخرسانة | 10 | 50 | 500 |
| 2024-01-02 | مورد الحديد | 5 | 100 | 500 |

### 2. رفع الملف / Upload File
- انتقل إلى صفحة "استيراد Excel"
- اختر الملف
- اضغط "تحليل الملف"

### 3. مراجعة التخطيط / Review Mapping
- راجع تخطيط الأعمدة المقترح
- عدّل إذا لزم الأمر
- اضغط "معالجة الاستيراد"

### 4. مراجعة النتائج / Review Results
- تحقق من عدد الصفوف المستوردة
- راجع التعارضات إن وجدت
- حل التعارضات في صفحة "التقارير"

## الترقية السريعة / Quick Upgrade Path

### المرحلة 1: تحسين الأداء / Phase 1: Performance
```bash
# إضافة Redis للتخزين المؤقت
npm install redis ioredis

# إضافة PM2 لإدارة العمليات
npm install -g pm2
pm2 start ecosystem.config.js
```

### المرحلة 2: قاعدة بيانات أقوى / Phase 2: Stronger Database
```bash
# ترقية إلى PostgreSQL
npm install pg
# تحديث knexfile.js
# تشغيل الهجرات
```

### المرحلة 3: واجهة متقدمة / Phase 3: Advanced UI
```bash
# ترقية إلى React
npx create-react-app client-react
# نقل المنطق من app.js
# تحديث API calls
```

## الدعم السريع / Quick Support

### المشاكل الشائعة / Common Issues

**التطبيق لا يبدأ / App won't start**
```bash
# تحقق من المنفذ
lsof -i :3000
# تحقق من قاعدة البيانات
ls -la data/
```

**خطأ في الاستيراد / Import Error**
```bash
# تحقق من صلاحيات المجلد
ls -la uploads/
# تحقق من حجم الملف
ls -lh uploads/
```

**مشكلة في المصادقة / Authentication Issue**
```bash
# تحقق من JWT_SECRET
cat .env | grep JWT
# إعادة تشغيل التطبيق
npm run dev
```

### روابط مفيدة / Useful Links
- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/guide/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Knex.js Query Builder](https://knexjs.org/)

### التواصل / Contact
- GitHub Issues للمشاكل التقنية
- Email للدعم العام
- Documentation للأسئلة الشائعة

---

**ملاحظة**: هذا الدليل مصمم للبدء السريع. للتفاصيل الكاملة، راجع README.md
**Note**: This guide is designed for quick start. For full details, see README.md

