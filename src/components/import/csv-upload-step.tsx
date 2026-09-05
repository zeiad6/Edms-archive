"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { parseCsv, type CsvRow } from "@/lib/csv-import";

export function UploadStep({
  onParsed,
}: {
  onParsed: (headers: string[], rows: CsvRow[]) => void;
}) {
  useLang(); // re-render on language toggle
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast.error(t("الرجاء اختيار ملف CSV"));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers, rows } = parseCsv(text);
        if (headers.length === 0) {
          toast.error(t("الملف لا يحتوي على بيانات صالحة"));
          return;
        }
        if (rows.length === 0) {
          toast.error(t("الملف لا يحتوي على سجلات"));
          return;
        }
        onParsed(headers, rows);
      };
      reader.readAsText(file);
    },
    [onParsed]
  );

  return (
    <div className="mx-auto max-w-xl animate-rise space-y-6">
      <div className="text-center">
        <span className="icon-tile mx-auto h-16 w-16 !rounded-2xl"><FileSpreadsheet className="h-8 w-8" /></span>
        <h2 className="mt-4 text-xl font-extrabold text-foreground">{t("استيراد مستندات من CSV")}</h2>
        <p className="section-sub mx-auto mt-2 max-w-md">{t("ارفع ملف CSV لإنشاء مستندات بالجملة. العمود الأول يُستخدم كعنوان تلقائياً.")}</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`card-interactive flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-12 shadow-soft ${
          dragging
            ? "border-primary bg-primary/5 shadow-card"
            : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03]"
        }`}
      >
        <Upload className={`h-10 w-10 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-sm font-semibold text-foreground">
          {dragging ? t("أفلت الملف هنا") : t("اسحب وأفلت ملف CSV هنا، أو اضغط للاختيار")}
        </span>
        <span className="rounded-lg bg-muted/70 px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-inset ring-border/50">{t("يدعم UTF-8 فقط")}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <details className="section-card card-sheen !rounded-2xl">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">{t("مثال: تنسيق CSV")}</summary>
        <pre className="tnum mt-3 overflow-x-auto rounded-xl border border-border bg-muted p-3 text-xs leading-6 text-muted-foreground" dir="ltr">
{`title,description,department,docType,tags,docDate
عقد صيانة,عقد صيانة سنوي,تقنية,عقد,صيانة,2026-01-15
فاتورة كهرباء,فاتورة شهر يوليو,مالية,فاتورة,كهرباء,2026-07-01`}
        </pre>
      </details>
    </div>
  );
}
