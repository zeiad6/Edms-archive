"use client";

import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

export type SpotlightKpiTone = "indigo" | "emerald" | "amber" | "sky" | "violet" | "rose";
export type SpotlightTrendDir = "up" | "down" | "flat";

export interface SpotlightKpiBreakdown {
  labelAr: string;
  value: string;
}

export interface SpotlightKpiItem {
  id: string;
  labelAr: string;
  hintAr?: string;
  value: string;
  unitAr?: string;
  trend?: { dir: SpotlightTrendDir; pct: string; captionAr: string };
  breakdown?: [SpotlightKpiBreakdown, SpotlightKpiBreakdown];
  tone?: SpotlightKpiTone;
  icon: ReactNode;
}

export interface SpotlightKpiRowProps {
  items: SpotlightKpiItem[];
  onMenuAction?: (id: string, action: "pin" | "export" | "remove") => void;
}

const TONE_TILE: Record<SpotlightKpiTone, string> = {
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
};

/**
 * Spotlight KPI row — RTL/bilingual adaptation of 21st `sean0205/statistics-card-10`.
 * Layout idea (header + hero value + delta badge + 2 breakdown rows) is inspired
 * by that card; all markup here is original and follows repo tokens
 * (section-card / icon-tile / shadow-card / animate-rise).
 */
export function SpotlightKpiRow({ items, onMenuAction }: SpotlightKpiRowProps) {
  useLang(); // re-render on language toggle
  return (
    <div className="stat-grid stagger" role="list" aria-label={t("إحصاءات سريعة")}>
      {items.map((item, i) => (
        <SpotlightKpiCard key={item.id} item={item} index={i} onMenuAction={onMenuAction} />
      ))}
    </div>
  );
}

function SpotlightKpiCard({
  item,
  index,
  onMenuAction,
}: {
  item: SpotlightKpiItem;
  index: number;
  onMenuAction?: SpotlightKpiRowProps["onMenuAction"];
}) {
  const tone = TONE_TILE[item.tone ?? "indigo"];
  const trend = item.trend;

  return (
    <article
      role="listitem"
      aria-label={t(item.labelAr)}
      style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
      className="section-card card-sheen card-interactive animate-rise flex flex-col gap-3 !p-5"
    >
      {/* Header: icon tile + title … menu (start-aligned, logical props only) */}
      <div className="flex items-center gap-2.5">
        <span className={`icon-tile h-10 w-10 text-lg ${tone}`} aria-hidden="true">
          {item.icon}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
          {t(item.labelAr)}
        </h3>
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={t("خيارات")}
            title={t("خيارات")}
            aria-haspopup="menu"
            onClick={(e) => {
              const menu = (e.currentTarget.nextElementSibling as HTMLElement | null);
              menu?.toggleAttribute("hidden");
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-soft transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <div
            hidden
            role="menu"
            className="surface-pop animate-pop absolute end-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-xl bg-card p-1 text-start shadow-pop"
          >
            {(
              [
                { k: "pin", labelAr: "تثبيت في اللوحة" },
                { k: "export", labelAr: "تصدير CSV" },
                { k: "remove", labelAr: "إزالة" },
              ] as const
            ).map((a) => (
              <button
                key={a.k}
                role="menuitem"
                type="button"
                onClick={(e) => {
                  (e.currentTarget.closest("[role='menu']") as HTMLElement)?.setAttribute("hidden", "");
                  onMenuAction?.(item.id, a.k);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-semibold text-foreground transition hover:bg-muted"
              >
                {t(a.labelAr)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hero value + unit */}
      <div className="flex items-baseline gap-2">
        <span className="tnum text-[1.7rem] font-extrabold leading-none tracking-tight text-foreground">
          {item.value}
        </span>
        {item.unitAr ? (
          <span className="text-xs font-medium text-muted-foreground">{t(item.unitAr)}</span>
        ) : null}
      </div>

      {/* Trend badge + caption */}
      {trend ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              trend.dir === "up"
                ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-300"
                : trend.dir === "down"
                  ? "inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-300"
                  : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground"
            }
          >
            {trend.dir === "down" ? (
              <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
            ) : trend.dir === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
            <span className="tnum" dir="ltr">
              {trend.pct}
            </span>
          </span>
          <span className="text-xs leading-5 text-muted-foreground">{t(trend.captionAr)}</span>
        </div>
      ) : item.hintAr ? (
        <p className="text-xs leading-5 text-muted-foreground">{t(item.hintAr)}</p>
      ) : null}

      {/* Breakdown rows */}
      {item.breakdown ? (
        <dl className="mt-auto space-y-1.5 pt-1">
          {item.breakdown.map((row) => (
            <div
              key={row.labelAr}
              className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2.5 py-2"
            >
              <dt className="truncate text-xs text-muted-foreground">{t(row.labelAr)}</dt>
              <dd className="tnum shrink-0 text-sm font-bold text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
