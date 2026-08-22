import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";

interface MonthlyTrendCardProps {
  months: Array<{ label: string; start: string }>;
  raw: number[];
  max: number;
}

/**
 * Documents per month bar chart over the last 6 months.
 */
export function MonthlyTrendCard({ months, raw, max }: MonthlyTrendCardProps) {
  const totalRaw = raw.reduce((s, v) => s + (v ?? 0), 0);
  return (
    <Card className="p-5 md:col-span-2 lg:col-span-1">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" /> الاتجاه الشهري
        </h3>
        <span className="text-[11px] text-muted-foreground">آخر 6 شهور</span>
      </div>
      {totalRaw === 0 ? (
        <EmptyState compact icon={TrendingUp} title="لا بيانات شهرية بعد" description="يظهر الاتجاه عند إيداع المستندات." />
      ) : (
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {months.map((m, i) => {
            const h = (raw[i] / max) * 100;
            return (
              <div key={m.start} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="tnum text-[10px] font-bold text-foreground">{raw[i]}</span>
                <div
                  className="w-full rounded-t-lg transition-all duration-150 hover:opacity-90 hover:brightness-110"
                  style={{
                    height: `${Math.max(4, h)}%`,
                    backgroundColor: `hsl(${220 + i * 12}, 70%, ${50 + i * 4}%)`,
                  }}
                />
                <span className="text-[9px] text-muted-foreground">{m.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
