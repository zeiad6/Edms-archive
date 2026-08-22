"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIELDS, guessMapping, type CsvRow } from "@/lib/csv-import";

export function PreviewStep({
  headers,
  rows,
  onBack,
  onImport,
  importing,
}: {
  headers: string[];
  rows: CsvRow[];
  onBack: () => void;
  onImport: (mapping: Record<string, string>) => Promise<void>;
  importing: boolean;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    guessMapping(headers)
  );
  const previewRows = rows.slice(0, 5);

  function setField(field: string, col: string) {
    setMapping((prev) => ({ ...prev, [field]: col }));
  }

  const unmappedRequired = FIELDS.filter(
    (f) => f.required && !mapping[f.key]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            معاينة البيانات
          </h2>
          <p className="text-sm text-gray-500">
            {rows.length.toLocaleString("ar")} سجل · {headers.length} عمود
          </p>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          {rows.length} مستند
        </span>
      </div>

      {/* Column mapping */}
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          ربط الأعمدة
        </h3>
        <div className="space-y-2">
          {FIELDS.map((field) => {
            const val = mapping[field.key] || "";
            return (
              <div
                key={field.key}
                className="flex items-center gap-3 rounded-lg bg-gray-50 p-2 dark:bg-gray-800/50"
              >
                <span className="w-28 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {field.label}
                  {field.required && (
                    <span className="ms-1 text-red-500">*</span>
                  )}
                </span>
                <select
                  value={val}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                >
                  <option value="">— تجاهل هذا العمود —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                {val && (
                  <span className="text-[10px] text-gray-400">{field.hint}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-start font-medium text-gray-500">#</th>
              {headers.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-3 py-2 text-start font-medium text-gray-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {previewRows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                {headers.map((h) => (
                  <td
                    key={h}
                    className="max-w-[200px] truncate px-3 py-2 text-gray-700 dark:text-gray-300"
                  >
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 5 && (
          <div className="border-t border-gray-100 px-3 py-2 text-center text-[11px] text-gray-400 dark:border-gray-800">
            ... وعرض {rows.length - 5} سجل آخر
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={importing}>
          <ArrowRight className="me-1 h-4 w-4" />
          رجوع
        </Button>
        <Button
          onClick={() => onImport(mapping)}
          disabled={importing || unmappedRequired.length > 0}
        >
          {importing ? (
            <>
              <Loader2 className="me-1 h-4 w-4 animate-spin" />
              جارٍ الاستيراد...
            </>
          ) : (
            <>
              <CheckCircle2 className="me-1 h-4 w-4" />
              استيراد {rows.length} مستند
            </>
          )}
        </Button>
      </div>
      {unmappedRequired.length > 0 && (
        <p className="text-xs text-amber-600">
          <AlertTriangle className="me-1 inline h-3 w-3" />
          الحقول المطلوبة غير مربوطة: {unmappedRequired.map((f) => f.label).join("، ")}
        </p>
      )}
    </div>
  );
}
