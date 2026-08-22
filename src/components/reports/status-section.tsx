"use client";

import { Filter } from "lucide-react";
import { Section, STATUS_META } from "./section";

interface StatusSectionProps {
  statuses: { status: string | null; count: number }[];
  totalDocs: number;
}

/** Distribution of documents by workflow status (progress bars). */
export function StatusSection({ statuses, totalDocs }: StatusSectionProps) {
  return (
    <Section title="توزيع المستندات حسب الحالة" icon={<Filter className="h-4 w-4" />} hasSearch={false}>
      <div className="space-y-2">
        {statuses.map((s) => {
          const m = STATUS_META[s.status ?? ""] ?? { label: s.status ?? "", color: "#94a3b8" };
          const pct = totalDocs > 0 ? ((s.count / totalDocs) * 100).toFixed(1) : "0";
          return (
            <div key={s.status} className="rounded-xl bg-muted px-4 py-3 transition hover:bg-muted/70">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="font-semibold text-foreground">{m.label}</span>
                </div>
                <span className="text-muted-foreground">{s.count} مستند ({pct}%)</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full transition-all"
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