"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Filter } from "lucide-react";
import { Section, STATUS_META } from "./section";

interface StatusSectionProps {
  statuses: { status: string | null; count: number }[];
  totalDocs: number;
}

/** Distribution of documents by workflow status (progress bars). */
export function StatusSection({ statuses, totalDocs }: StatusSectionProps) {
  useLang(); // re-render on language toggle
  return (
    <Section title={t("توزيع المستندات حسب الحالة")} icon={<Filter className="h-4 w-4" />} hasSearch={false}>
      <div className="space-y-2">
        {statuses.map((s) => {
          const m = STATUS_META[s.status ?? ""] ?? { label: s.status ?? "", color: "#94a3b8" };
          const pct = totalDocs > 0 ? ((s.count / totalDocs) * 100).toFixed(1) : "0";
          return (
            <div key={s.status} className="rounded-xl bg-muted px-4 py-3 shadow-soft ring-1 ring-inset ring-border/50 transition hover:bg-muted/70 hover:shadow-card">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: m.color }} />
                  <span className="font-semibold text-foreground">{t(m.label)}</span>
                </div>
                <span className="tnum text-muted-foreground">{t("{n} مستند ({p}%)", { n: s.count, p: pct })}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background shadow-inner">
                <div
                  className="h-full rounded-full shadow-sm transition-all"
                  style={{ width: `${pct}%`, backgroundColor: m.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}