import { PieChart } from "lucide-react";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";

interface DocTypesCardProps {
  typeRows: Array<{ type: string | null; c: number; color: string | null }>;
  total: number;
}

/**
 * Document type distribution bars (top 6 types).
 */
export function DocTypesCard({ typeRows, total }: DocTypesCardProps) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
        <PieChart className="h-4 w-4 text-primary" /> توزيع الأنواع
      </h3>
      {typeRows.length === 0 ? (
        <EmptyState compact icon={PieChart} title="لا توجد أنواع بعد" description="تظهر هنا توزيعات أنواع المستندات عند الإيداع." />
      ) : (
        <div className="space-y-2.5">
          {typeRows.slice(0, 6).map((r) => {
            const pct = total ? (r.c / total) * 100 : 0;
            const hex = r.color ?? "#64748b";
            return (
              <div key={r.type ?? "null"} className="group flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-[11px] text-muted-foreground">{r.type ?? "غير محدد"}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-lg bg-muted">
                  <div
                    className="flex h-full items-center justify-end rounded-lg px-1.5 text-[10px] font-bold text-white transition-all duration-150 group-hover:opacity-90"
                    style={{ width: `${Math.max(4, pct)}%`, backgroundColor: hex }}
                  >
                    {pct > 8 && r.c}
                  </div>
                </div>
                <span className="w-7 text-start text-[11px] font-bold text-foreground">{r.c}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
