import { Building2 } from "lucide-react";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";

interface DepartmentsDistributionProps {
  byDept: Array<{ name: string; color: string; c: number }>;
}

/**
 * Documents count per department with proportional bars.
 */
export function DepartmentsDistribution({ byDept }: DepartmentsDistributionProps) {
  const maxDept = Math.max(1, ...byDept.map((d) => Number(d.c)));
  return (
    <Card className="p-5 lg:col-span-2">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
        <Building2 className="h-4 w-4 text-primary" /> توزيع المستندات حسب القسم
      </h3>
      {byDept.length === 0 ? (
        <EmptyState compact icon={Building2} title="لا توجد أقسام بعد" description="عند إنشاء الأقسام وإيداع مستنداتها تظهر النسب هنا." />
      ) : (
        <div className="space-y-3">
          {byDept.map((d) => (
            <div key={d.name} className="flex items-center gap-3">
              <div className="w-28 shrink-0 truncate text-sm text-muted-foreground">{d.name}</div>
              <div className="h-7 flex-1 overflow-hidden rounded-lg bg-muted">
                <div
                  className="flex h-full items-center justify-start rounded-lg px-2 text-[11px] font-bold text-white transition-all"
                  style={{ width: `${(Number(d.c) / maxDept) * 100}%`, backgroundColor: d.color, minWidth: Number(d.c) > 0 ? 32 : 0 }}
                >
                  {Number(d.c) > 0 && Number(d.c)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
