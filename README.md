# أرشيف · نظام الأرشفة الإلكترونية (EDMS)

منصة أرشفة إلكترونية مؤسسية آمنة مبنية على معمارية **الخادم الموحّد (Unified Backend)**:
تُبنى الواجهة مرة واحدة بتقنيات الويب، ثم تُغلَّف لتعمل كتطبيق سطح مكتب عبر **Electron**
للوصول إلى العتاد المحلي (الماسحة الضوئية). كل المعالجة، التخزين، البحث، والصلاحيات
تجري مركزياً في الخادم.

## التنفيذ الحالي (واجهة الويب — Next.js)

تم تنفيذ النواة الكاملة للنظام بواجهة عربية (RTL) باستخدام **Next.js (App Router) +
PostgreSQL (Drizzle ORM)**، مع تطبيق نفس المبادئ المعمارية للنظام المؤسسي:

| المبدأ المؤسسي | التطبيق هنا |
| --- | --- |
| التخزين الكائني (MinIO) | ملفات على قرص منفصل عن قاعدة البيانات، تُخدَم عبر مسار بث آمن يتحقق من الصلاحيات (`/api/documents/[id]/file`) |
| محرك البحث (Meilisearch) | بحث نصّي شامل في PostgreSQL عبر `ILIKE` على العنوان والوصف ورقم المستند **والنص المستخرج من OCR** |
| بث آمن للمستندات | عارض يبث الملف من الخادم (`inline`) دون حفظه محلياً، مع `Cache-Control: no-store` و `nosniff` |
| صلاحيات (RBAC) | أدوار (مدير نظام / مشرف قسم / موظف) مع تقييد المستندات السرية والنطاق حسب القسم |
| تدقيق كامل (Audit) | جدول `audit_logs` يسجّل كل عملية (عرض/تنزيل/رفع/تعديل/حذف/بحث/دخول) |
| الجسر المحلي للماسحة | عميل WebSocket يتصل بـ `ws://127.0.0.1:8181` داخل Electron (مع محاكاة للوضع المتصفحي) |

### الميزات
- **لوحة معلومات**: إحصاءات، توزيع الحالات والأقسام، أحدث المستندات، وموجز النشاط.
- **المستندات**: تصفّح وبحث شامل مع تصفية (الحالة/القسم/النوع/المجلد) واحترام الصلاحيات.
- **تفاصيل المستند**: عارض آمن (صور/PDF)، تعديل البيانات الوصفية، الإصدارات، وسجل الكيان.
- **الرفع**: سحب وإفلات + بيانات وصفية، مع محاكاة لمرحلة المعالجة والفهرسة.
- **الماسحة الضوئية**: جسر WebSocket مع معاينة Base64 فورية وحفظ في الأرشيف.
- **الأقسام / المستخدمون / سجل النشاط**: إدارة كاملة.

> النظام **يُهيّئ نفسه تلقائياً**: عند أول تشغيل يُنشئ الجداول ويُولّد مستندات عربية
> واقعية (صور SVG ممسوحة + ملفات PDF) وبيانات تجريبية دون أي خطوات يدوية.

## حزمة التقنيات المستهدفة (Enterprise)

- **الخادم**: C# .NET 8 (REST APIs) · **PostgreSQL** · **MinIO** · **Meilisearch**
- **الواجهة**: React + TypeScript · **Tailwind CSS** (RTL) · **PDF.js** · **Electron**
- **المعالجة**: **Tesseract OCR** (عربي/إنجليزي) · **Node.js + WebSockets** (جسر العتاد)

## جسر الماسحة الضوئية (Electron + C# WIA)

### 1) خادم WebSocket المحلي داخل Electron (`main.js`)
يُفتح على `127.0.0.1:8181` حصراً، ويستدعي أداة المسح ويعيد الصورة كـ Base64:

```js
const { app, BrowserWindow } = require("electron");
const WebSocket = require("ws");
const { execFile } = require("child_process");
const path = require("path");

let wss;
function startScannerBridge() {
  wss = new WebSocket.Server({ port: 8181, host: "127.0.0.1" });
  wss.on("connection", (ws) => {
    console.log("✅ React Client connected to Scanner Bridge");
    ws.on("message", async (message) => {
      try {
        const request = JSON.parse(message);
        if (request.action === "START_SCAN") {
          const base64Image = await performScan();
          ws.send(JSON.stringify({
            status: "SUCCESS",
            image: `data:image/png;base64,${base64Image}`,
          }));
        }
      } catch (error) {
        ws.send(JSON.stringify({ status: "ERROR", message: error.message }));
      }
    });
  });
}

// يستدعي أداة C# ويعيد Base64 النقي عبر stdout
function performScan() {
  return new Promise((resolve, reject) => {
    const exePath = path.join(__dirname, "assets", "bin", "ScannerCLI.exe");
    execFile(exePath, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      const base64Data = stdout.trim();
      if (!base64Data) return reject(new Error("لم يتم استقبال أي بيانات من الماسحة."));
      resolve(base64Data);
    });
  });
}

app.whenReady().then(() => {
  startScannerBridge();
  // createBrowserWindow() ...
});
```

### 2) أداة المسح C# عبر WIA (`ScannerCLI/Program.cs`)
تعرض نافذة المسح الأصلية لويندوز وتعيد الصورة Base64 عبر stdout:

```csharp
using System;
using System.IO;
using WIA; // مرجع COM: Microsoft Windows Image Acquisition Library v2.0

namespace ScannerCLI
{
    class Program
    {
        [STAThread] // WIA يتطلب STA Thread
        static void Main(string[] args)
        {
            try
            {
                CommonDialog wiaDialog = new CommonDialog();
                ImageFile scannedImage = wiaDialog.ShowAcquireImage(
                    WiaDeviceType.ScannerDeviceType,
                    WiaImageIntent.ColorIntent,
                    WiaImageBias.MaximizeQuality,
                    "{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}", // PNG
                    false, true, true);

                if (scannedImage != null)
                {
                    string tempFilePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.png");
                    scannedImage.SaveFile(tempFilePath);
                    byte[] imageBytes = File.ReadAllBytes(tempFilePath);
                    File.Delete(tempFilePath);
                    Console.Write(Convert.ToBase64String(imageBytes));
                    Environment.Exit(0);
                }
            }
            catch (Exception ex)
            {
                Console.Error.Write($"SCAN_ERROR: {ex.Message}");
                Environment.Exit(1);
            }
        }
    }
}
```

> **الأمان:** الربط بـ `127.0.0.1` حتمي لمنع أي جهاز على الشبكة المحلية من الوصول للماسحة.

## التشغيل (واجهة الويب)

```bash
npm install
npm run dev      # تطوير
npm run build    # إنتاج
```

قاعدة البيانات تُهيّأ ذاتياً عبر `DATABASE_URL`. لا حاجة لأي ترحيل يدوي.

## النشر (إنتاج)

### المتطلبات
- **Node.js 20+** (الخادم يعمل كعملية واحدة: `next start`).
- **Tesseract OCR** اختياري — بدون تثبيته تُعطَّل خاصية استخراج النص من الصور (أو حدد المسار عبر `TESSERACT_PATH`).

### خطوات النشر
```bash
npm ci                       # تثبيت نظيف حسب lockfile
npm run build                # بناء إنتاجي (أُنشئ مرات عديدة — عملية واحدة فقط)
npm start                    # تشغيل الخادم (منفذ 3000 افتراضياً)
```
> تشغيل **عملية واحدة فقط**: لا تشغّل `next dev` أو نسخاً متعددة من `next start` على نفس المجلد — قاعدة SQLite ملفية لا تتحمل كتابة متزامنة من عمليات متعددة.

### المتغيرات المطلوبة
- **`AUTH_SECRET` إلزامي** — يولَّد عبر:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
  بدونه يعمل النظام بمفتاح تطويري مع تحذير في السجل (غير آمن للإنترنت).
- **`DATABASE_URL`** → `file:./data/edms.db` (يُنشأ تلقائياً).
- **`NEXT_PUBLIC_APP_URL`** → عنوان النطاق الفعلي (لا `localhost`).

### HTTPS والكوكي الآمن
- ضع الخادم خلف وكيل عكسي (Nginx/Caddy) ينهي TLS ويوجّه إلى المنفذ 3000.
- خيارات الكوكي في `src/lib/session.ts`: `secure` مضبوط على `false` ليعمل على HTTP و HTTPS معاً (مناسب للديمو) — عند النشر خلف HTTPS حصراً، ارفعه إلى `true`.

### النسخ الاحتياطي (يدوي)
1. **أوقف** الخادم (`Ctrl+C` أو إيقاف الخدمة).
2. انسخ ZIP احتياطياً ثم **فك ضغطه فوق** `data/storage` (المستندات) مع `data/edms.db` (قاعدة البيانات).
3. **أعد تشغيل** الخادم.

> لا تنسخ الملفات فوق `data/storage` والـ DB أثناء تشغيل الخادم — قواعد SQLite قد تتلف عند الكتابة المتزامنة.

### OCR على Linux
- ثبّت Tesseract: `sudo apt install tesseract-ocr tesseract-ocr-ara` (أو حسب التوزيعة).
- حدد المسار صراحةً إن لم يُكتشف تلقائياً:
  ```
  TESSERACT_PATH=/usr/bin/tesseract
  ```
