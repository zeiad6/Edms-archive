"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

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
  useLang(); // re-render on language toggle
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
    <div className="page-stack animate-rise">
      <div className="toolbar justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">{t("معاينة البيانات")}</h2>
          <p className="section-sub tnum">
            {t("{n} سجل · {c} عمود", { n: rows.length, c: headers.length })}
          </p>
        </div>
        <span className="tnum rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary shadow-soft ring-1 ring-inset ring-primary/20">
          {t("{n} مستند", { n: rows.length })}
        </span>
      </div>

      {/* Column mapping */}
      <div className="section-card card-sheen">
        <h3 className="section-title mb-3">{t("ربط الأعمدة")}</h3>
        <div className="space-y-2.5">
          {FIELDS.map((field) => {
            const val = mapping[field.key] || "";
            return (
              <div
                key={field.key}
                className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2 shadow-soft ring-1 ring-inset ring-border/40"
              >
                <span className="w-28 shrink-0 text-xs font-semibold text-foreground">
                  {t(field.label)}
                  {field.required && (
                    <span className="ms-1 text-danger">*</span>
                  )}
                </span>
                <select
                  value={val}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="min-h-[2.5rem] flex-1 cursor-pointer rounded-xl border border-border bg-card px-2 py-1.5 text-xs text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">{t("— تجاهل هذا العمود —")}</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                {val && (
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">{t(field.hint)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview table */}
      <div className="table-shell overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th>#</th>
              {headers.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i}>
                <td className="tnum text-muted-foreground">{i + 1}</td>
                {headers.map((h) => (
                  <td
                    key={h}
                    className="max-w-[200px] truncate text-foreground"
                  >
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 5 && (
          <div className="tnum border-t border-border px-3 py-2 text-center text-[11px] text-muted-foreground">
            {t("... وعرض {n} سجل آخر", { n: rows.length - 5 })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="toolbar justify-between">
        <Button variant="outline" onClick={onBack} disabled={importing}>
          <ArrowRight className="me-1 h-4 w-4" />{t("رجوع")}</Button>
        <Button
          onClick={() => onImport(mapping)}
          disabled={importing || unmappedRequired.length > 0}
        >
          {importing ? (
            <>
              <Loader2 className="me-1 h-4 w-4 animate-spin" />{t("جارٍ الاستيراد...")}</>
          ) : (
            <>
              <CheckCircle2 className="me-1 h-4 w-4" />
              {t("استيراد {n} مستند", { n: rows.length })}
            </>
          )}
        </Button>
      </div>
      {unmappedRequired.length > 0 && (
        <p className="animate-fadein rounded-xl bg-warning/10 px-3 py-2 text-xs font-medium text-warning ring-1 ring-inset ring-warning/20">
          <AlertTriangle className="me-1 inline h-3 w-3" />
          {t("الحقول المطلوبة غير مربوطة: {f}", { f: unmappedRequired.map((f) => t(f.label)).join("، ") })}
        </p>
      )}
    </div>
  );
}
