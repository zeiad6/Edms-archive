"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Upload, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/csv-import";

export function DoneStep({
  result,
  onReset,
}: {
  result: ApiResponse;
  onReset: () => void;
}) {
  const router = useRouter();
  const failures = result.results.filter((r) => !r.success);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        {result.failed === 0 ? (
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
        ) : (
          <AlertTriangle className="mx-auto h-16 w-16 text-amber-500" />
        )}
        <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
          {result.failed === 0 ? "تم الاستيراد بنجاح" : "اكتمل مع بعض الأخطاء"}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 p-4 text-center dark:border-gray-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {result.total}
          </div>
          <div className="text-xs text-gray-500">الإجمالي</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {result.imported}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400">تم بنجاح</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {result.failed}
          </div>
          <div className="text-xs text-red-600 dark:text-red-400">فشل</div>
        </div>
      </div>

      {failures.length > 0 && (
        <div className="rounded-xl border border-red-200 p-4 dark:border-red-800">
          <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
            تفاصيل الأخطاء
          </h3>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {failures.map((f) => (
              <div key={f.row} className="flex gap-2 text-xs">
                <span className="shrink-0 font-mono text-gray-400">#{f.row}</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {f.title || "(بدون عنوان)"}
                </span>
                <span className="text-red-500">— {f.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onReset}>
          <Upload className="me-1 h-4 w-4" />
          استيراد ملف آخر
        </Button>
        <Button onClick={() => router.push("/documents")}>
          <ArrowLeft className="me-1 h-4 w-4" />
          عرض المستندات
        </Button>
      </div>
    </div>
  );
}
