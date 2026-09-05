"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Filter } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { DeptRow } from "@/lib/reports";
import { Section } from "./section";

interface DeptSectionProps {
  depts: DeptRow[];
  totalDocs: number;
  search: string;
  onSearch: (v: string) => void;
}

/** Distribution of documents by department (progress bars). */
export function DeptSection({ depts, totalDocs, search, onSearch }: DeptSectionProps) {
  useLang(); // re-render on language toggle
  return (
    <Section
      title={t("توزيع المستندات حسب القسم")}
      icon={<Filter className="h-4 w-4" />}
      search={search}
      onSearch={onSearch}
      placeholder={t("بحث في الأقسام...")}
    >
      <div className="space-y-2.5">
        {depts.map((d) => {
          const pct = totalDocs > 0 ? ((d.count / totalDocs) * 100).toFixed(1) : "0";
          return (
            <div key={d.deptId ?? 0} className="rounded-2xl border border-transparent bg-muted px-4 py-3 shadow-soft transition hover:border-primary/20 hover:shadow-card">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.deptColor ?? "#94a3b8" }} />
                  <span className="font-semibold text-foreground">{d.deptName ?? t("بدون قسم")}</span>
                </div>
                <span className="tnum text-muted-foreground">{t("{n} مستند · {s}", { n: d.count, s: formatBytes(d.size) })}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full border border-border/60 bg-background">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: d.deptColor ?? "#94a3b8" }}
                />
              </div>
            </div>
          );
        })}
        {depts.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">{t("لا توجد نتائج مطابقة.")}</p>}
      </div>
    </Section>
  );
}