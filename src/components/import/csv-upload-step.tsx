"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { parseCsv, type CsvRow } from "@/lib/csv-import";

export function UploadStep({
  onParsed,
}: {
  onParsed: (headers: string[], rows: CsvRow[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast.error("الرجاء اختيار ملف CSV");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers, rows } = parseCsv(text);
        if (headers.length === 0) {
          toast.error("الملف لا يحتوي على بيانات صالحة");
          return;
        }
        if (rows.length === 0) {
          toast.error("الملف لا يحتوي على سجلات");
          return;
        }
        onParsed(headers, rows);
      };
      reader.readAsText(file);
    },
    [onParsed]
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <FileSpreadsheet className="mx-auto h-16 w-16 text-indigo-500" />
        <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
          استيراد مستندات من CSV
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          ارفع ملف CSV لإنشاء مستندات بالجملة. العمود الأول يُستخدم كعنوان تلقائياً.
        </p>
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
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-12 transition-colors ${
          dragging
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
            : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
        }`}
      >
        <Upload className={`h-10 w-10 ${dragging ? "text-indigo-500" : "text-gray-400"}`} />
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {dragging ? "أفلت الملف هنا" : "اسحب وأفلت ملف CSV هنا، أو اضغط للاختيار"}
        </span>
        <span className="text-xs text-gray-400">يدعم UTF-8 فقط</span>
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

      <details className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
          مثال: تنسيق CSV
        </summary>
        <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
{`title,description,department,docType,tags,docDate
عقد صيانة,عقد صيانة سنوي,تقنية,عقد,صيانة,2026-01-15
فاتورة كهرباء,فاتورة شهر يوليو,مالية,فاتورة,كهرباء,2026-07-01`}
        </pre>
      </details>
    </div>
  );
}
