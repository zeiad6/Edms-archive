# CHANGELOG — EDMS Archive (أرشيف EDMS)

التنسيق مبني على [Keep a Changelog](https://keepachangelog.com/)، والإصدارات تتبع [Semantic Versioning](https://semver.org/).
الإصدارات الرسمية تُنشر في: <https://github.com/zeiad6/Edms-archive/releases>

---

## [1.0.7] — 2026-11-18 · ZeidexSoft

ترقية معمارية وأمنية وبصرية شاملة مع محرك الترقية والترحيل الآمن للبيانات (Safe Upgrade Engine) وتوافق رجعي 100% مع الإصدارات السابقة (`1.0.0` حتى `1.0.7`) دون فقدان أي بيانات.

### 🛡️ المرحلة 0: محرك الترقية الآمن وضمان عدم فقدان البيانات (Zero Data Loss)

- **النسخ الاحتياطي التلقائي قبل الترقية والتراجع الذاتي (`Pre-Upgrade Snapshot & Auto-Rollback`)** — فحص إصدار التطبيق في `data/app-version.json` و`PRAGMA user_version` قبل تشغيل خادم Next.js أو تطبيق الترحيلات (`electron/main.cjs`, `src/lib/upgrade-engine.ts`, `src/lib/seed.ts`). عند اكتشاف ترقية يُنشأ snapshot ذري عبر `VACUUM INTO` في `data/backups/pre-upgrade/` (مع الاحتفاظ بآخر 5 نسخ)، ويُفحص `PRAGMA integrity_check` و`PRAGMA foreign_key_check` قبل وبعد الترحيل مع استرجاع تلقائي فوري عند أي خطأ.
- **ترحيلات مخطط ذرية متسلسلة (`Sequential Atomic Schema Migrations`)** — توحيد `src/db/schema.ts` و`src/lib/seed.ts` (إضافة `signatures` و`document_templates` و`ocr_text` و`keywords` و`source` و`notes` و`doc_type`)، وتحويل الترحيلات إلى ترحيلات مرقّمة (`user_version 1..3`) داخل معاملات `BEGIN IMMEDIATE ... COMMIT` مع `ROLLBACK` تلقائي.
- **حماية دورة حياة Electron والتحديث** — إضافة خيار «إنشاء نسخة احتياطية آمنة الآن ثم التحديث» في إشعار التحديث، وتنفيذ `PRAGMA wal_checkpoint(TRUNCATE)` عبر `/api/health?checkpoint=1` عند `before-quit` لضمان إغلاق نظيف لقاعدة البيانات قبل تشغيل مثبّت NSIS.

### 🔧 المرحلة 1: إصلاح الأعطال الحرجة وحماية الملفات والنسخ الاحتياطي

- **حماية ملفات المستندات من الحذف الخاطئ** — التحقق الصارم من وجود المستند في سلة المحذوفات (`deletedAt !== null`) ونجاح حذف السجل في قاعدة البيانات قبل حذف ملفات القرص في `forceDeleteDocument`، وتقسيم الحذف الجماعي في `emptyTrash` إلى دفعات آمنة (`DELETE_CHUNK_SIZE = 200`).
- **إصلاح الجمود (Deadlock) في النسخ الاحتياطي وتحصين الاستعادة** — تحويل `/api/backup` إلى تدفق حقيقي (`Readable.toWeb`) مع لقطة `VACUUM INTO` واستبعاد `.env` وتسجيل التدقيق `system.backup`؛ وتحصين `/api/restore` بفحص سلسلة الروابط الرمزية (`assertNoSymlinkChainBeforeMkdir`) قبل `mkdirSync`، وحدود الحماية من قنابل الضغط (`MAX_BACKUP_SIZE = 500MB`, `MAX_UNCOMPRESSED_SIZE = 1GB`, `MAX_ENTRY_COUNT = 10000`)، وفحص ترويسة `SQLite format 3\0`، وحذف ملفات `-wal`/`-shm` المتبقية.
- **ذرية إنشاء المستندات وفصل نص OCR عن الوصف** — تغليف إنشاء المستند والإصدار والوسوم والتدقيق داخل `db.transaction(...)` مع تنظيف الملفات اليتيمة عند الفشل، وحفظ نص OCR في عمود `ocr_text` المستقل مع دمج ذكي في `content_text` للبحث وتمييز حالات `ocr_processed` (`0`, `1`, `2`, `-1`).

### 🔐 المرحلة 2: تحصين الصلاحيات (RBAC) والأمان وعزل Electron

- **إحكام صلاحيات RBAC وفحص نشاط الحساب** — إضافة صلاحيتي `documents.update` و`documents.ocr`، والتحقق من `user.active` في جميع العمليات، وتطبيق فلاتر القسم ومستوى السرية و`isNull(documents.deletedAt)` على كافة استعلامات لوحة القيادة (`src/app/page.tsx`) وإجراءات الخادم.
- **تحصين رفع الملفات ومحدد محاولات الدخول** — فحص التوقيع الثنائي الفعلي (`Magic Bytes`) للملفات المرفوعة، وتطهير ملفات `.svg` عبر `DOMPurify`، وتوحيد الامتدادات إلى أحرف صغيرة، وتطبيع مفاتيح `login-throttle` مع تنظيف دوري للذاكرة (`LOGIN_MAX_KEYS = 5000`).
- **عزل Electron والمتجر الآمن (`Secure Store`)** — التحقق من المنفذ المحلي الفعلي في `isLocalAppUrl`، وفحص `!win.isDestroyed()` و`event.senderFrame` في قنوات IPC، وتحصين `secure-store` ضد Prototype Pollution (`Object.create(null)`) مع كتابة ذرية عبر ملف `.tmp` وتوافق رجعي مع `secrets.json` و`secure-store.json`.
- **فرض قيود المفاتيح الأجنبية (Foreign Keys) على SQLite** — `PRAGMA foreign_keys = ON` و`PRAGMA synchronous = NORMAL` عند فتح الاتصال (`src/db/index.ts`).
- **حدّ ضد التخمين (Brute-force) مربوط بالحساب + IP** — مفتاح التقييد `<الحساب>:<IP العميل>` عبر دالة `loginThrottleKey` (`src/lib/login-throttle.ts`, `src/actions/auth.ts`).
- **كوكي الجلسة `Secure` في الإنتاج** — `secure` في `SESSION_COOKIE_OPTIONS` = `(NODE_ENV === 'production')` (`src/lib/session.ts`).
- **تحقق صيغة التوقيع الإلكتروني** — مسار `/api/signatures` يرفض أي Data URL ليس صورة base64 صالحة (PNG/JPEG/WebP).
- **حماية مسارات المسح الضوئي على غير ويندوز** — `/api/scan` و`/api/scan/hardware` تردّ 503 فوراً على Linux/macOS.
- **خدمة ترقيم موحّدة (`clampPagination`)** — في `src/lib/services/pagination.ts` لحماية مسارات البحث من `pageSize` سالب أو ضخم.

### ✨ المرحلة 3: الأداء وتجربة المستخدم (UI/UX) وعارض المستندات والبحث الفوري

- **فصل تخطيط الجذر والبحث الفوري الخفيف (SQLite FTS5 Spotlight)** — فصل `RootLayout` عن الجلب الثقيل، وإضافة فهرس البحث النصي الكامل `documents_fts` (FTS5) مع مسار `/api/search/spotlight` وبحث لحظي (`Debounce 250ms`) في الشريط العلوي ولوحة الأوامر `Ctrl+K`، وحصر مبدّل المستخدمين التجريبي بالمديرين فقط.
- **عارض PDF احترافي بتدفق ثنائي مباشر (`Binary Streaming & Range Requests`)** — دعم `206 Partial Content` و`Accept-Ranges: bytes` في `/api/documents/[id]/file`، وتحميل PDF مباشرة عبر URL التدفق في `DocViewer` مع شريط مصغرات الصفحات، وبحث نصي داخل المستند، وملاءمة العرض (`Fit to Width`)، وتدوير الصفحات، والطباعة المباشرة، ومعالجة `RenderingCancelledException`.
- **تطوير صفحة المستندات ومنطقة الرفع والإعدادات** — إضافة التبديل بين عرض الجدول (`Table`) وعرض البطاقات (`Cards`)، ودرج المعاينة السريعة (`Quick Preview Drawer`)، وتصدير CSV المصفّى، وشريط تقدم رفع حقيقي عبر `XMLHttpRequest` مع اقتراح تلقائي لبيانات OCR، وبطاقة «حالة الترقية والنسخ الاحتياطية التلقائية» في الإعدادات.
- **بطاقة أفعال سريعة للمستند** (`DocumentQuickActions`) في الشريط الجانبي لصفحة تفاصيل المستند: رمز QR عبر `@zxing/library`، نسخ البيانات التعريفية، مشاركة، وطباعة.
- **تصفية سريعة وبحث لحظي في صفحة المستندات** — رقائق تصفية بحسب الحالة مع عدّادات مباشرة (`src/components/documents-page-client.tsx`).
- **زر «البحث الذكي» ⌘K في لوحة القيادة** وبطاقات `StatCard` التفاعلية.

### 🏷️ الهوية ومعلومات المطور (ZeidexSoft)

- تحديث هوية المطور في كل مواضع الإسناد إلى **ZeidexSoft**: شاشة الدخول، القائمة الجانبية، بطاقة «حول البرنامج» في الإعدادات، حقل `author` في `package.json` الذي يظهر في خصائص التطبيق والمثبّت، وبذرة حساب المدير في التثبيت الجديد.
- رابط المطور الرسمي: `https://zeidexlink.zeidexsoft.com/zeidex` — يُقرأ من مصدر واحد (`src/components/brand-marks.tsx`) بما يشمل استبدال الرابط القديم `zeidex.netlify.app` في الواجهة و`README`.
- **رابط مستودع GitHub للمشروع** (`https://github.com/zeiad6/Edms-archive`) في شاشة الدخول، القائمة الجانبية، وبطاقة «حول البرنامج».
- **زر «تبرّع لدعم المشروع» ❤️** في مواضع الثلاثة أعلاه. يفتح صفحة دفع مستضافة (Stripe Payment Link أو PayPal) تُقرأ من متغير البيئة `NEXT_PUBLIC_DONATE_URL`؛ عند غيابه يُستخدم رابط صفحة المطور. **لا تُكتب أي بيانات بنكية أو مفاتيح داخل الكود مطلقاً** — الدفع يُستقبل على صفحة مستضافة آمنة خارج التطبيق وتقبل Mastercard.
- ظهور الإصدار في الإعدادات: `EDMS 1.0.7 (ZeidexSoft)`.

### 🗄️ قاعدة البيانات والتوافقية

- **ترحيلات إضافية آمنة 100% (Additive-only Migrations)** — كافة الإضافات الجديدة في المخطط (`ocr_text`, `signatures`, `document_templates`, `documents_fts`) تضاف تلقائياً داخل معاملات ذرية دون المساس بأي جدول أو عمود أو ملف قائم.
- **اختبارات الأمان عند الترقية (`upgrade-safety` و`migration-safety`)** تشغّل الإصدار الجديد على قواعد بيانات من الإصدارات السابقة (`v1.0.0` حتى `v1.0.7`) وتتحقق من سلامة كافة السجلات والملفات واسترجاع اللقطات التلقائية عند الفشل.
- الترقية من 1.0.0 حتى 1.0.7: شغّل المثبّت الجديد مباشرة؛ بيانات `%APPDATA%` (القاعدة، المستندات، الحسابات وكلمات المرور) تبقى كما هي.

---

## [1.0.6] — 2026-10-03

تحديث أمني وإصلاحات للإصدار 1.0.0، متضمناً كل تغييرات 1.0.1 التي لم تُنشر كإصدار مستقل. التفصيل الكامل في صفحة [إصدار v1.0.6](https://github.com/zeiad6/Edms-archive/releases/tag/v1.0.6). أبرز الفقرات:

- إغلاق ثغرة تجاوز إلزام تغيير كلمة المرور عبر «تبديل المستخدم»، وصلاحية استعادة إصدار مستند، وصلاحيات القسم/المجلد في حفظ المستندات الممسوحة، وحذف الملفات فعلياً في القرص في الحذف النهائي، ورفض الروابط الرمزية (symlinks) في الاستعادة، وعزل الروابط الخارجية عن نافذة التطبيق، وإخفاء المسارات الداخلية في رسائل الأخطاء.
- ترقيات الحزم: `next 16.3.7` (ثغرة RCE)، `sharp`، `nanoid`، `adm-zip`، `dompurify` (XSS). نتيجة `npm audit`: صفر ثغرات.
- شاشة دخول جديدة مع زر إظهار كلمة المرور وخيار حفظ بيانات الدخول مشفّرة؛ لوحة أوامر `Ctrl+K`؛ التثبيت الجديد يبذر حساب مدير واحد فقط (`admin / 12345678` مع إجبار تغيير كلمة المرور عند أول دخول).
- البناء والاختبار: المثبّت يُبنى على GitHub Actions فقط، مع اختبار `upgrade-safety` واختبار ترقية حقيقي على ويندوز قبل النشر (يشترط ظهور نافذة التطبيق فعلياً)، وإضافة نموذج OCR العربي `ara.traineddata` إلى المثبّت، و`latest.yml` مرفقاً في الإصدار كي يظهر إشعار التحديث داخل البرنامج القديم تلقائياً.

## [1.0.0] — 2026-09-30

الإصدار الأول من نظام الأرشفة الإلكتروني EDMS: أرشفة محلية آمنة (SQLite/libSQL + Drizzle ORM)، صلاحيات أدوار متعددة، سجل تدقيق كامل، بحث نصي عربي سريع وكامل، مسح ضوئي عبر WIA، OCR عربي/إنجليزي عبر Tesseract، نسخ احتياطي شامل، ومثبّت ويندوز NSIS غير موقّع (SmartScreen عند أول تشغيل).
