"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Filter } from "lucide-react";
import type { MonthlyRow } from "@/lib/reports";
import { Section, MONTH_LABELS } from "./section";

/** Monthly document deposit trend (bar chart). */
export function TrendSection({ monthly }: { monthly: MonthlyRow[] }) {
  useLang(); // re-render on language toggle
  const maxCount = Math.max(...monthly.map((x) => x.count));

  return (
    <Section title={t("الاتجاه الشهري لإيداع المستندات")} icon={<Filter className="h-4 w-4" />} hasSearch={false}>
      <div className="flex items-end gap-1.5" dir="ltr">
        {monthly.map((m) => {
          const [, mm] = m.month.split("-");
          const hPct = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
          const label = MONTH_LABELS[mm] ?? mm;
          return (
            <div key={m.month} className="group flex flex-1 flex-col items-center gap-1">
              <span className="tnum text-[10px] font-medium text-muted-foreground">{m.count}</span>
              <div
                className="w-full rounded-t-md shadow-sm transition-all group-hover:brightness-110"
                style={{
                  height: `${Math.max(hPct, 4)}px`,
                  backgroundColor: "#3b82f6",
                  opacity: 0.4 + (hPct / 100) * 0.6,
                }}
                title={t("{m}: {n} مستند", { m: label, n: m.count })}
              />
              <span className="text-[10px] text-muted-foreground">{t(label)}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}