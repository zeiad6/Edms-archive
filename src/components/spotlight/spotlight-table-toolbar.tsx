"use client";

import { useState } from "react";
import { Check, ChevronDown, Download, Search, SlidersHorizontal, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

export interface SpotlightColumnOption {
  id: string;
  labelAr: string;
  visible: boolean;
}

export interface SpotlightTableToolbarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  totalCount: number;
  selectedCount?: number;
  columns?: SpotlightColumnOption[];
  onToggleColumn?: (id: string, visible: boolean) => void;
  onExport?: () => void;
  exporting?: boolean;
  pageIndex: number;
  pageCount: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * Premium data-table toolbar + pagination footer — RTL/bilingual adaptation of
 * the 21st `shadcn/data-table` demo toolbar pattern (filter input + columns
 * menu + selection count + prev/next). Original markup, repo tokens
 * (.toolbar / .input-base / .section-card / shadow-soft), logical props only.
 */
export function SpotlightTableToolbar({
  searchValue,
  onSearchChange,
  totalCount,
  selectedCount = 0,
  columns = [],
  onToggleColumn,
  onExport,
  exporting = false,
  pageIndex,
  pageCount,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: SpotlightTableToolbarProps) {
  useLang(); // re-render on language toggle
  const [colsOpen, setColsOpen] = useState(false);

  return (
    <div className="section-card flex flex-col gap-3">
      {/* Toolbar row: search (grows) + columns menu + export */}
      <div className="toolbar">
        <div className="relative min-w-0 flex-1 basis-52">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("بحث سريع في كل الأعمدة...")}
            aria-label={t("بحث سريع في كل الأعمدة...")}
            className="input-base pe-9"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label={t("مسح")}
              title={t("مسح")}
              className="absolute end-2.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {columns.length > 0 ? (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setColsOpen((v) => !v)}
              aria-expanded={colsOpen}
              aria-haspopup="menu"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground shadow-soft transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {t("الأعمدة")}
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${colsOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {colsOpen ? (
              <div
                role="menu"
                aria-label={t("الأعمدة")}
                className="surface-pop animate-pop absolute end-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl bg-card p-1 text-start shadow-pop"
              >
                {columns.map((c) => (
                  <button
                    key={c.id}
                    role="menuitemcheckbox"
                    aria-checked={c.visible}
                    type="button"
                    onClick={() => onToggleColumn?.(c.id, !c.visible)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-semibold text-foreground transition hover:bg-muted"
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                        c.visible
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    {t(c.labelAr)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {onExport ? (
          <button
            type="button"
            onClick={onExport}
            disabled={exporting || totalCount === 0}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-soft transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? t("جارٍ التصدير…") : t("تصدير CSV")}
          </button>
        ) : null}
      </div>

      {/* Status + pagination footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <p className="tnum me-auto" aria-live="polite">
          {selectedCount > 0
            ? t("{n} مُحدد من {t} سجل", { n: selectedCount, t: totalCount })
            : t("{n} سجل", { n: totalCount })}
        </p>
        <div className="flex items-center gap-2">
          <span className="tnum" aria-label={t("الصفحات")}>
            {t("صفحة {c} من {t}", { c: Math.max(pageIndex + 1, 1), t: Math.max(pageCount, 1) })}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              aria-label={t("الصفحة التالية")}
              className="inline-flex min-h-8 items-center rounded-lg border border-border bg-card px-3 font-bold text-foreground shadow-soft transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
            <span aria-hidden="true" className="inline-block rtl:rotate-180">‹</span>
            &nbsp;{t("الصفحة التالية")}
            </button>
            <button
              type="button"
              onClick={onPrevious}
              disabled={!canPrevious}
              aria-label={t("الصفحة السابقة")}
              className="inline-flex min-h-8 items-center rounded-lg border border-border bg-card px-3 font-bold text-foreground shadow-soft transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
            {t("الصفحة السابقة")}&nbsp;
            <span aria-hidden="true" className="inline-block rtl:rotate-180">›</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
