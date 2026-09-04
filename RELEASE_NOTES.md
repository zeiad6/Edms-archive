<!-- RELEASE NOTES — UTF-8 only. Do NOT save this file in any other encoding
     (Windows-1256 / ANSI turns Arabic into question marks on the GitHub release page).
     This file is used as body_path by .github/workflows/release.yml -->

## أرشيف — الإصدار 1.0.0 (أول إصدار رسمي) 🎉

نظام الأرشفة الإلكترونية EDMS — منصة أرشفة مؤسسية آمنة بواجهة عربية كاملة (RTL)،
تعمل على الويب وتُغلَّف كتطبيق سطح مكتب للوصول إلى عتاد المسح المحلي.

### ✨ الجديد في هذا الإصدار

- 📄 **عارض PDF جديد (pdf.js)** — معاينة سريعة وآمنة داخل التطبيق دون حفظ محلي.
- 🖨️ **نافذة مسح جديدة من الطابعة (WIA)** — مسح فردي ومتعدد مع معاينة وترتيب قبل الإيداع.
- 🔔 **إشعارات التحديث عبر GitHub** — تنبيه داخل التطبيق عند توفر إصدار جديد مع زر انتقال للتحميل.
- 💻 **مثبّت Setup جديد لويندوز (Windows x64)** — تثبيت عادي + نسخة محمولة (Portable).

### ⬇️ التحميل (ويندوز فقط)

| النسخة | الملف | الرابط المباشر |
| --- | --- | --- |
| المثبّت (موصى به) | `EDMS-Archive-1.0.0-Setup-x64.exe` | [تحميل مباشر](https://github.com/g53208084-debug/Edms-archive/releases/download/v1.0.0/EDMS-Archive-1.0.0-Setup-x64.exe) |
| نسخة محمولة (بدون تثبيت) | `EDMS-Archive-1.0.0-Portable-x64.exe` | [تحميل مباشر](https://github.com/g53208084-debug/Edms-archive/releases/download/v1.0.0/EDMS-Archive-1.0.0-Portable-x64.exe) |

> ⚠️ **الحزمة لنظام ويندوز 64-بت (Windows x64) فقط.**
> عند أول تشغيل قد تظهر شاشة SmartScreen لأن البناء غير موقّع — اختر «المزيد من المعلومات» ثم «تشغيل على أي حال».

### 🔐 ملاحظات

- الحساب الافتراضي للتجربة: `k.alomari` / كلمة المرور `Password@123` (تُطلب عند أول دخول).
- كل تثبيت يولّد مفتاح `AUTH_SECRET` خاص به عند أول إقلاع.
- إغلاق النافذة = تسجيل خروج تلقائي.
