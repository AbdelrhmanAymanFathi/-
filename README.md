# نظام محاسبة التسليمات والنقل
## Deliveries & Transport Accounting System

نظام شامل لإدارة وتسجيل عمليات التسليم والنقل في شركة إنشاءات، مع دعم استيراد ملفات الإكسيل ومعالجة الصيغ الرياضية تلقائياً.

A comprehensive system for managing and recording delivery and transport operations in a construction company, with support for Excel file imports and automatic formula processing.

## ✨ الميزات الرئيسية / Key Features

### 🔐 المصادقة والصلاحيات / Authentication & Authorization
- **نظام تسجيل دخول آمن** / Secure login system
- **إدارة الأدوار** / Role management (مدير، محاسب، مراجع)
- **تحكم في الصلاحيات** / Permission control
- **سجلات التدقيق** / Audit logs

### 📊 لوحة التحكم / Dashboard
- **إحصائيات شاملة** / Comprehensive statistics
- **مؤشرات الأداء** / Performance indicators
- **رسوم بيانية تفاعلية** / Interactive charts
- **مراقبة النشاط** / Activity monitoring

### 📁 استيراد الإكسيل / Excel Import
- **رفع ملفات الإكسيل** / Excel file upload
- **تخطيط الأعمدة الذكي** / Smart column mapping
- **واجهة تعديل التخطيط** / Interactive mapping editor
- **معاينة البيانات** / Data preview
- **تنظيف البيانات تلقائياً** / Automatic data cleaning
- **معالجة الصيغ الرياضية** / Formula processing

### ⚠️ إدارة النزاعات / Conflict Management
- **كشف النزاعات تلقائياً** / Automatic conflict detection
- **واجهة حل النزاعات** / Conflict resolution interface
- **خيارات الحل المتعددة** / Multiple resolution options
- **تتبع حالة النزاعات** / Conflict status tracking

### 🔄 معالجة المهام الخلفية / Background Job Processing
- **قوائم المهام** / Job queues
- **معالجة متوازية** / Parallel processing
- **مراقبة التقدم** / Progress monitoring
- **إدارة الأخطاء** / Error handling
- **واجهة المراقبة** / Monitoring interface

### 📈 التقارير / Reports
- **تقارير التسليمات** / Delivery reports
- **تقارير مالية** / Financial reports
- **تحليل الموردين** / Supplier analysis
- **اتجاهات شهرية** / Monthly trends
- **تصدير CSV/JSON** / CSV/JSON export

## 🛠️ التقنيات المستخدمة / Technologies Used

### Backend
- **Node.js 18+** - Runtime environment
- **Express.js** - Web framework
- **SQLite** - Database (development)
- **PostgreSQL** - Database (production ready)
- **Knex.js** - Query builder & migrations
- **Objection.js** - ORM
- **JWT** - Authentication
- **BullMQ** - Job queues
- **Redis** - Cache & job storage

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling (RTL support)
- **JavaScript ES6+** - Interactivity
- **Font Awesome** - Icons

### Processing & Validation
- **XLSX** - Excel file reading
- **XLSX-Calc** - Excel formula evaluation
- **Hot-Formula-Parser** - Formula parsing
- **Joi** - Data validation
- **Multer** - File uploads

### Security & Monitoring
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - API protection
- **Winston** - Logging
- **Audit trails** - Activity tracking

## 🚀 التثبيت والإعداد / Installation & Setup

### المتطلبات / Requirements
- Node.js 18+
- npm أو yarn
- SQLite (development)
- Redis (for job queues)

### التثبيت / Installation
```bash
# Clone the repository
git clone <repository-url>
cd deliveries-accounting-system

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Configure environment variables
# Edit .env file with your settings

# Run database migrations
npm run migrate

# Seed initial data
npm run seed

# Start development server
npm run dev
```

### متغيرات البيئة / Environment Variables
```bash
# Database
DB_CLIENT=sqlite3
DB_FILENAME=./data/deliveries.db

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Server
PORT=3000
NODE_ENV=development

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Redis (for job queues)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## 📋 حسابات التجربة / Demo Accounts

| الدور / Role | البريد الإلكتروني / Email | كلمة المرور / Password |
|-------------|-------------------------|----------------------|
| مدير / Manager | manager@company.com | password123 |
| محاسب / Accountant | accountant@company.com | password123 |
| مراجع / Auditor | auditor@company.com | password123 |

## 🏗️ بنية المشروع / Project Structure

```
├── server/                 # Backend server
│   ├── migrations/        # Database migrations
│   ├── seeds/            # Database seeders
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── middleware/       # Custom middleware
│   └── utils/            # Utility functions
├── client/                # Frontend client
│   └── public/           # Static files
├── data/                  # Database files
├── uploads/               # File uploads
├── logs/                  # Application logs
└── tests/                 # Test files
```

## 🔌 نقاط النهاية / API Endpoints

### المصادقة / Authentication
- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/logout` - تسجيل الخروج
- `GET /api/auth/me` - معلومات المستخدم الحالي

### التسليمات / Deliveries
- `GET /api/deliveries` - قائمة التسليمات
- `POST /api/deliveries` - إنشاء تسليم جديد
- `PUT /api/deliveries/:id` - تحديث تسليم
- `DELETE /api/deliveries/:id` - حذف تسليم
- `POST /api/deliveries/:id/recompute` - إعادة حساب الحقول

### الاستيراد / Import
- `POST /api/import/excel` - رفع ملف إكسيل
- `POST /api/import/process` - معالجة البيانات
- `GET /api/import/batches` - سجل الاستيراد
- `GET /api/import/conflicts` - النزاعات
- `PUT /api/import/conflicts/:id/resolve` - حل النزاعات

### التقارير / Reports
- `GET /api/reports/summary` - ملخص عام
- `GET /api/reports/deliveries` - تقرير التسليمات
- `GET /api/reports/conflicts` - تقرير النزاعات
- `GET /api/reports/export` - تصدير البيانات

### المستخدمون / Users
- `GET /api/users` - قائمة المستخدمين
- `GET /api/users/activity` - نشاط المستخدمين
- `GET /api/users/stats/overview` - إحصائيات المستخدمين

### مراقبة المهام / Job Monitoring
- `GET /api/queue/stats` - إحصائيات القوائم
- `GET /api/queue/jobs/active` - المهام النشطة
- `GET /api/queue/jobs/recent` - آخر المهام
- `GET /api/queue/jobs/:id` - تفاصيل المهمة
- `POST /api/queue/jobs/:id/pause` - إيقاف مؤقت
- `POST /api/queue/jobs/:id/cancel` - إلغاء المهمة
- `POST /api/queue/jobs/:id/retry` - إعادة المحاولة

## 🔧 معالجة الصيغ / Formula Processing

### الصيغ المدعومة / Supported Formulas
- **القيمة الإجمالية** / Gross Value: `volume * unit_price`
- **القيمة الصافية** / Net Value: `gross_value - discount`
- **الحجم** / Volume: `gross_value / unit_price`
- **سعر الوحدة** / Unit Price: `gross_value / volume`
- **الخصم** / Discount: `gross_value - net_value`

### آلية المعالجة / Processing Mechanism
1. **كشف الصيغ** / Formula detection
2. **تقييم تلقائي** / Automatic evaluation
3. **تحديث الحقول** / Field updates
4. **سجل التغييرات** / Change logging

## ⚠️ إدارة النزاعات / Conflict Management

### أنواع النزاعات / Conflict Types
- **قسيمة مكررة** / Duplicate voucher
- **حقول مطلوبة مفقودة** / Missing required fields
- **بيانات غير صحيحة** / Invalid data
- **مفتاح خارجي غير موجود** / Foreign key violation
- **خطأ في التحقق** / Validation error

### خيارات الحل / Resolution Options
- **الاحتفاظ بالأصل** / Keep original
- **الاحتفاظ بالجديد** / Keep new
- **دمج البيانات** / Merge data
- **تعديل يدوي** / Manual edit
- **تخطي السجل** / Skip record

## 🔄 نظام المهام الخلفية / Background Job System

### أنواع المهام / Job Types
- **استيراد الإكسيل** / Excel import processing
- **إعادة حساب الحقول** / Field recalculation
- **توليد التقارير** / Report generation

### ميزات النظام / System Features
- **معالجة متوازية** / Parallel processing
- **إعادة المحاولة التلقائية** / Automatic retry
- **مراقبة التقدم** / Progress monitoring
- **إدارة الأخطاء** / Error handling
- **تنظيف تلقائي** / Automatic cleanup

## 🧪 الاختبارات / Testing

### تشغيل الاختبارات / Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- recomputeService.test.js
```

### أنواع الاختبارات / Test Types
- **اختبارات الوحدة** / Unit tests
- **اختبارات التكامل** / Integration tests
- **اختبارات API** / API tests
- **اختبارات قاعدة البيانات** / Database tests

## 📊 المراقبة والتسجيل / Monitoring & Logging

### التسجيل / Logging
- **سجلات الأخطاء** / Error logs
- **سجلات النشاط** / Activity logs
- **سجلات التدقيق** / Audit logs
- **سجلات الأداء** / Performance logs

### المراقبة / Monitoring
- **صحة النظام** / System health
- **أداء قاعدة البيانات** / Database performance
- **استخدام الذاكرة** / Memory usage
- **وقت الاستجابة** / Response time

## 🔒 الأمان / Security

### ميزات الأمان / Security Features
- **مصادقة JWT** / JWT authentication
- **تشفير كلمات المرور** / Password hashing
- **حماية من CSRF** / CSRF protection
- **تقييد معدل الطلبات** / Rate limiting
- **رؤوس الأمان** / Security headers
- **تسجيل الأحداث** / Event logging

## 🚀 التطوير المستقبلي / Future Development

### التحسينات المخططة / Planned Improvements
- **واجهة React** / React frontend
- **قاعدة بيانات PostgreSQL** / PostgreSQL database
- **Docker containerization** / Docker deployment
- **NGINX reverse proxy** / NGINX configuration
- **PM2 process manager** / PM2 management
- **Redis caching** / Redis implementation
- **نظام التنبيهات** / Notification system
- **API documentation** / API docs
- **Mobile app** / Mobile application

### قابلية التوسع / Scalability
- **معالجة متوازية** / Parallel processing
- **قوائم المهام** / Job queues
- **تخزين مؤقت** / Caching
- **موازنة الأحمال** / Load balancing
- **قاعدة بيانات موزعة** / Distributed database

## 🐛 استكشاف الأخطاء / Troubleshooting

### مشاكل شائعة / Common Issues
1. **خطأ في قاعدة البيانات** / Database error
   - تأكد من تشغيل SQLite
   - تحقق من صلاحيات الملفات

2. **خطأ في Redis** / Redis error
   - تأكد من تشغيل Redis
   - تحقق من إعدادات الاتصال

3. **خطأ في رفع الملفات** / File upload error
   - تحقق من حجم الملف
   - تأكد من نوع الملف

4. **خطأ في المصادقة** / Authentication error
   - تحقق من صحة JWT
   - تأكد من انتهاء الصلاحية

## 📞 الدعم / Support

### طرق التواصل / Contact Methods
- **GitHub Issues** - للمشاكل التقنية
- **Email** - للدعم العام
- **Documentation** - للدليل التقني

### الموارد / Resources
- **API Documentation** - وثائق API
- **User Guide** - دليل المستخدم
- **Developer Guide** - دليل المطور
- **Troubleshooting** - استكشاف الأخطاء

## 📄 الترخيص / License

هذا المشروع مرخص تحت رخصة MIT. راجع ملف LICENSE للتفاصيل.

This project is licensed under the MIT License. See the LICENSE file for details.

---

**ملاحظة** / Note: هذا النظام مصمم للاستخدام في بيئة تطويرية. للاستخدام الإنتاجي، يرجى مراجعة إعدادات الأمان والأداء.

**Note**: This system is designed for development use. For production use, please review security and performance settings.

