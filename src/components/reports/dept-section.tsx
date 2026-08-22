"use client";

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
  return (
    <Section
      title="توزيع المستندات حسب القسم"
      icon={<Filter className="h-4 w-4" />}
      search={search}
      onSearch={onSearch}
      placeholder="بحث في الأقسام..."
    >
      <div className="space-y-2">
        {depts.map((d) => {
          const pct = totalDocs > 0 ? ((d.count / totalDocs) * 100).toFixed(1) : "0";
          return (
            <div key={d.deptId ?? 0} className="rounded-xl bg-muted px-4 py-3 transition hover:bg-muted/70">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.deptColor ?? "#94a3b8" }} />
                  <span className="font-semibold text-foreground">{d.deptName ?? "بدون قسم"}</span>
                </div>
                <span className="text-muted-foreground">{d.count} مستند · {formatBytes(d.size)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: d.deptColor ?? "#94a3b8" }}
                />
              </div>
            </div>
          );
        })}
        {depts.length === 0 && <p className="text-xs text-muted-foreground">لا توجد نتائج مطابقة.</p>}
      </div>
    </Section>
  );
}