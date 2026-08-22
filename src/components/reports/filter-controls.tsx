"use client";

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
  if (monthly.length <= 1) return null;

  return (
    <>
      <button
        onClick={onToggle}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition",
          show
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:bg-muted",
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        {show ? "إخفاء فلتر التاريخ" : "فلترة الشهر"}
      </button>

      {show && (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <select
            value={fromIdx}
            onChange={(e) => {
              const v = Number(e.target.value);
              onFrom(v);
              if (v > toIdx) onTo(v);
            }}
            className="rounded-lg border border-border bg-muted px-2 py-1 text-xs outline-none"
          >
            {monthly.map((m, i) => {
              const [, mm] = m.month.split("-");
              return (
                <option key={m.month} value={i}>
                  {MONTH_LABELS[mm] ?? mm} {m.month.slice(0, 4)}
                </option>
              );
            })}
          </select>
          <span>→</span>
          <select
            value={toIdx}
            onChange={(e) => onTo(Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1 text-xs outline-none"
          >
            {monthly.slice(fromIdx).map((m, i) => {
              const [, mm] = m.month.split("-");
              return (
                <option key={m.month} value={fromIdx + i}>
                  {MONTH_LABELS[mm] ?? mm} {m.month.slice(0, 4)}
                </option>
              );
            })}
          </select>
        </span>
      )}
    </>
  );
}