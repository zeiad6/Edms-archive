/**
 * Tiny custom Arabic/English i18n system — no external libraries.
 *
 * - Keys are EXACT Arabic source strings; values are the English translations.
 * - `t()` returns the Arabic string unchanged unless the module-level language
 *   is "en" (set client-side via the LangProvider / setLang).
 * - Server components always render with the default "ar" — safe by design.
 */

export type Lang = "ar" | "en";

export const DICT: Record<string, string> = {
  // ---- Login ---------------------------------------------------------------
  "نظام الأرشفة الإلكترونية": "Electronic Archive System",
  "سجّل دخولك للمتابعة إلى الأرشيف": "Sign in to continue to the archive",
  "تسجيل الدخول": "Sign in",
  "دخول": "Sign in",
  "اختيار المستخدم": "Choose user",
  "أدخل كلمة المرور": "Enter your password",
  "اختر المستخدم (تجريبي)": "Select user (demo)",
  "اسم المستخدم": "Username",
  "كلمة المرور": "Password",
  "كلمة المرور الجديدة": "New password",
  "تأكيد كلمة المرور": "Confirm password",
  "جاري تسجيل الدخول…": "Signing in…",
  "جاري الحفظ…": "Saving…",
  "تغيير كلمة المرور": "Change password",
  "إلغاء": "Cancel",
  "كلمة المرور الافتراضية لجميع الحسابات: ": "Default password for all accounts: ",
  "كلمة المرور الافتراضية لجميع الحسابات: Password@123": "Default password for all accounts: Password@123",
  "حسابات تجريبية": "Demo accounts",
  "مدير النظام (admin)": "System administrator (admin)",
  "مشرف قسم (manager)": "Department manager (manager)",
  "موظف (employee)": "Employee",
  "مشرفة الشؤون المالية": "Financial affairs supervisor",
  "أخصائية موارد بشرية": "HR specialist",
  "سكرتيرة تنفيذية": "Executive secretary",
  "واجهة محاكاة صلاحيات · نظام تجريبي": "Permissions simulation interface · Demo system",
  "تم تطوير البرنامج بواسطة": "Developed by",

  // ---- Roles (ROLE_META labels) --------------------------------------------
  "مدير النظام": "System administrator",
  "مشرف قسم": "Department manager",
  "موظف": "Employee",

  // ---- Sidebar navigation --------------------------------------------------
  "الأرشيف": "Archive",
  "لوحة المعلومات": "Dashboard",
  "المستندات": "Documents",
  "بحث متقدم": "Advanced search",
  "رفع مستند": "Upload document",
  "استيراد CSV": "Import CSV",
  "الماسحة الضوئية": "Scanner",
  "لوحة التحليلات": "Analytics",
  "المجلدات": "Folders",
  "الموافقات والإشعارات": "Approvals & notifications",
  "الموافقات": "Approvals",
  "الإشعارات": "Notifications",
  "الإدارة": "Administration",
  "الأقسام": "Departments",
  "المستخدمون": "Users",
  "سجل النشاط": "Audit log",
  "الوسوم": "Tags",
  "التقارير": "Reports",
  "سلة المحذوفات": "Trash",
  "التصنيفات": "Categories",
  "القوالب": "Templates",
  "الصلاحيات": "Permissions",
  "الإعدادات": "Settings",

  // ---- Shell ---------------------------------------------------------------
  "نظام الأرشفة الإلكتروني": "Electronic Archive System",
  "أرشيف / نظام الأرشفة الإلكتروني": "Archive / Electronic Archive System",
  "أرشيف — نظام الأرشفة الإلكتروني": "Archive — Electronic Archive System",
  "توسيع القائمة": "Expand menu",
  "طي القائمة": "Collapse menu",
  "تبديل المُشغّل (محاكاة الصلاحيات)": "Switch operator (permissions simulation)",
  "كلمة مرور": "Password for",
  "جاري التبديل…": "Switching…",
  "الحالي": "Current",
  "جاري تسجيل الخروج…": "Signing out…",
  "تسجيل الخروج": "Sign out",
  "هل أنت متأكد من تسجيل الخروج؟": "Are you sure you want to sign out?",
  "أرشيف مؤسسي آمن": "Secure institutional archive",
  "تخزين محلي آمن · صلاحيات · تدقيق · بث آمن": "Secure local storage · Permissions · Audit · Secure streaming",

  // ---- Global search box ---------------------------------------------------
  "ابحث عن أي مستند أو رقم أو قسم... (بحث ذكي مرن)": "Search for any document, number, or department... (smart flexible search)",

  // ---- Dashboard hero ------------------------------------------------------
  "لديك": "You have",
  "مستند في الأرشيف": "documents in the archive",
  "جديد هذا الأسبوع": "new this week",
  "جديد هذا الأسبوع.": "new this week.",
  "مسح ضوئي": "Scan",
  "تصفّح الأرشيف": "Browse archive",
  "إجمالي": "Total",
  "سارية": "Valid",
  "هذا الأسبوع": "This week",
  "صباح الخير": "Good morning",
  "مساء الخير": "Good evening",

  // ---- Electron title bar --------------------------------------------------
  "EDMS": "EDMS",
  "تصغير": "Minimize",
  "استعادة": "Restore",
  "تكبير": "Maximize",
  "إغلاق": "Close",

  // ---- Page headers --------------------------------------------------------
  "سجل تفاعلي للمستندات — فرز وبحث وتصدير وترقيم صفحات": "Interactive document log — sort, search, export, and pagination",
  "إيداع مستند جديد": "Submit a new document",
  "ارفع ملف واحد أو عدة ملفات وأكمل بياناتها الوصفية": "Upload one or more files and complete their metadata",
  "بحث متقدم في الأرشيف": "Advanced search in the archive",
  "امسح المستندات مباشرة باستخدام الكاميرا — دعم باركود تلقائي واستخراج OCR": "Scan documents directly with the camera — automatic barcode support and OCR extraction",
  "لوحة تحليلات الأرشيف": "Archive analytics dashboard",
  "نظرة شاملة على الأرشيف: التوزيعات، الاتجاهات، الهيكل، ونشاط الإيداع": "An overview of the archive: distributions, trends, structure, and deposit activity",
  "تصفّح الهيكل الهرمي للأرشيف وانتقل إلى مستندات كل مجلد": "Browse the archive hierarchy and jump to each folder's documents",
  "إدارة طلبات الموافقة على المستندات": "Manage document approval requests",
  "تصنيف المستندات والمستخدمين حسب القسم الإداري": "Classify documents and users by administrative department",
  "إدارة المشغّلين وأدوارهم وصلاحياتهم": "Manage operators, their roles, and permissions",
  "تتبّع كامل لجميع العمليات على المستندات والنظام (Audit Trail)": "Full tracking of all operations on documents and the system (Audit Trail)",
  "إدارة الوسوم": "Manage tags",
  "أنشئ وحرّر واحذف الوسوم المستخدمة في تصنيف المستندات": "Create, edit, and delete tags used to classify documents",
  "التقارير والإحصائيات": "Reports & statistics",
  "نظرة تحليلية على بيانات الأرشيف — متاح للمدراء والمسؤولين": "Analytical view of archive data — available to managers and admins",
  "المستندات المحذوفة مؤقتاً — يمكن استعادتها أو حذفها نهائياً.": "Temporarily deleted documents — can be restored or permanently deleted.",
  "تصنيفات المستندات": "Document categories",
  "إدارة أنواع المستندات — الألوان والترتيب": "Manage document types — colors and ordering",
  "قوالب المستندات": "Document templates",
  "أنشئ قوالب لرفع المستندات بسرعة دون إعادة إدخال البيانات الوصفية": "Create templates to upload documents quickly without re-entering metadata",
  "مصفوفة صلاحيات الأدوار — تعريف الصلاحيات لكل دور": "Role permissions matrix — define permissions for each role",
  "لا تملك صلاحية الوصول": "You don't have access permission",
  "نظرة عامة على النظام، تفضيلات المظهر، ومعلومات البنية": "System overview, appearance preferences, and architecture information",

  // ---- Scanner errors (hardware WIA scan route) -----------------------------
  "لم يتم العثور على ماسح ضوئي متصل بالجهاز": "No scanner connected to this device was found",
  "خدمة المسح الضوئي (WIA) غير متوفرة على هذا النظام": "The scanning service (WIA) is unavailable on this system",
  "تعذر إجراء المسح الضوئي — تحقق من توصيل الطابعة/الماسح": "Scan failed — check that the printer/scanner is connected",

  // ---- Settings: backup & restore ------------------------------------------
  "النسخ الاحتياطي والاستعادة": "Backup & restore",
  "ينزّل ملف ZIP واحداً يحتوي قاعدة البيانات بالكامل وكل ملفات التخزين (المستندات والصور الممسوحة) مع ملف وصف (manifest) — احفظه على جهازك أو وسيط خارجي للاستعادة عند الحاجة.": "Downloads a single ZIP containing the full database and all storage files (documents and scanned images) with a manifest — keep it on your device or external media for restore when needed.",
  "إنشاء نسخة احتياطية": "Create backup",
  "جاري إنشاء النسخة الاحتياطية…": "Creating backup…",
  "تم إنشاء النسخة الاحتياطية بنجاح": "Backup created successfully",
  "فشل إنشاء النسخة الاحتياطية": "Failed to create the backup",
  "استعادة نسخة احتياطية": "Restore backup",
  "اختيار ملف ZIP": "Choose ZIP file",
  "جاري تحليل الملف…": "Reading file…",
  "فشل تحليل ملف النسخة الاحتياطية": "Failed to read the backup file",
  "لا توجد أجزاء قابلة للاستعادة في الملف": "No restorable parts in the file",
  "اختر الأجزاء المطلوب استعادتها:": "Select the parts to restore:",
  "استعادة الأجزاء المحددة": "Restore selected parts",
  "جاري الاستعادة…": "Restoring…",
  "تمت الاستعادة بنجاح": "Restore completed successfully",
  "سيتم تطبيق قاعدة البيانات والإعدادات بعد إعادة تشغيل التطبيق": "The database and settings will be applied after restarting the app",
  "فشلت الاستعادة": "Restore failed",
  "لم يتم اختيار أي جزء للاستعادة": "No part selected for restore",
  "ملاحظة: استعادة قاعدة البيانات والإعدادات تتطلب إعادة تشغيل التطبيق": "Note: restoring the database and settings requires restarting the app",
  "ملف": "file",
  "قاعدة البيانات": "Database",
  "ملفات التخزين": "Storage files",
  "سكربتات النظام": "System scripts",
  "إعدادات النظام": "System config",
};

let currentLang: Lang = "ar";

export function getLang(): Lang {
  return currentLang;
}

export function setLang(l: Lang): void {
  currentLang = l;
}

export function t(ar: string): string {
  if (currentLang !== "en") return ar;
  return DICT[ar] ?? ar;
}