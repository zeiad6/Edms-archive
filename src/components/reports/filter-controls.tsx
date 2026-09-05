"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Calendar } from "lucide-react";
import { cn } from "@/lib/format";
import type { MonthlyRow } from "@/lib/reports";
import { MONTH_LABELS } from "./section";

interface DateRangeFilterProps {
  monthly: MonthlyRow[];
  fromIdx: number;
  toIdx: number;
  show: boolean;
  onToggle: () => void;
  onFrom: (idx: number) => void;
  onTo: (idx: number) => void;
}

/** Toggle button + from/to month selects for the monthly trend chart. */
export function DateRangeFilter({
  monthly,
  fromIdx,
  toIdx,
  show,
  onToggle,
  onFrom,
  onTo,
}: DateRangeFilterProps) {
  useLang(); // re-render on language toggle
  if (monthly.length <= 1) return null;

  return (
    <>
      <button
        onClick={onToggle}
        className={cn(
          "inline-flex min-h-[2.25rem] items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium shadow-soft transition hover:shadow-card",
          show
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground",
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        {show ? t("إخفاء فلتر التاريخ") : t("فلترة الشهر")}
      </button>

      {show && (
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <select
            value={fromIdx}
            onChange={(e) => {
              const v = Number(e.target.value);
              onFrom(v);
              if (v > toIdx) onTo(v);
            }}
            className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs shadow-soft outline-none transition hover:border-primary/30 focus:border-ring"
          >
            {monthly.map((m, i) => {
              const [, mm] = m.month.split("-");
              return (
                <option key={m.month} value={i}>
                  {t(MONTH_LABELS[mm] ?? mm)} {m.month.slice(0, 4)}
                </option>
              );
            })}
          </select>
          <span>→</span>
          <select
            value={toIdx}
            onChange={(e) => onTo(Number(e.target.value))}
            className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs shadow-soft outline-none transition hover:border-primary/30 focus:border-ring"
          >
            {monthly.slice(fromIdx).map((m, i) => {
              const [, mm] = m.month.split("-");
              return (
                <option key={m.month} value={fromIdx + i}>
                  {t(MONTH_LABELS[mm] ?? mm)} {m.month.slice(0, 4)}
                </option>
              );
            })}
          </select>
        </span>
      )}
    </>
  );
}