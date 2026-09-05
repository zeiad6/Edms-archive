"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

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
  useLang(); // re-render on language toggle
  const router = useRouter();
  const failures = result.results.filter((r) => !r.success);

  return (
    <div className="mx-auto max-w-xl animate-pop space-y-6">
      <div className="text-center">
        {result.failed === 0 ? (
          <span className="icon-tile mx-auto h-16 w-16 !rounded-2xl !text-success"><CheckCircle2 className="h-8 w-8" /></span>
        ) : (
          <span className="icon-tile mx-auto h-16 w-16 !rounded-2xl !text-warning"><AlertTriangle className="h-8 w-8" /></span>
        )}
        <h2 className="mt-4 text-xl font-extrabold text-foreground">
          {result.failed === 0 ? t("تم الاستيراد بنجاح") : t("اكتمل مع بعض الأخطاء")}
        </h2>
      </div>

      <div className="stat-grid !grid-cols-3">
        <div className="section-card card-sheen !rounded-2xl p-4 text-center">
          <div className="tnum text-2xl font-extrabold text-foreground">
            {result.total}
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">{t("الإجمالي")}</div>
        </div>
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-center shadow-soft">
          <div className="tnum text-2xl font-extrabold text-success">
            {result.imported}
          </div>
          <div className="mt-1 text-xs font-semibold text-success">{t("تم بنجاح")}</div>
        </div>
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center shadow-soft">
          <div className="tnum text-2xl font-extrabold text-danger">
            {result.failed}
          </div>
          <div className="mt-1 text-xs font-semibold text-danger">{t("فشل")}</div>
        </div>
      </div>

      {failures.length > 0 && (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.04] p-4 shadow-soft">
          <h3 className="section-title mb-2 !text-danger">{t("تفاصيل الأخطاء")}</h3>
          <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {failures.map((f) => (
              <div key={f.row} className="flex items-center gap-2 rounded-lg bg-card px-2 py-1.5 text-xs shadow-soft ring-1 ring-inset ring-border/50">
                <span className="tnum shrink-0 font-mono text-muted-foreground">#{f.row}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {f.title || t("(بدون عنوان)")}
                </span>
                <span className="shrink-0 text-danger">— {f.error ? t(f.error) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="toolbar justify-center">
        <Button variant="outline" onClick={onReset}>
          <Upload className="me-1 h-4 w-4" />{t("استيراد ملف آخر")}</Button>
        <Button onClick={() => router.push("/documents")}>
          <ArrowLeft className="me-1 h-4 w-4" />{t("عرض المستندات")}</Button>
      </div>
    </div>
  );
}
