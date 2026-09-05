import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { ListChecks } from "lucide-react";
import { STATUS_META } from "@/lib/format";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface StatusSegment {
  s: string;
  c: number;
  pct: number;
  color: string;
}

interface StatusDistributionProps {
  segments: StatusSegment[];
}

/**
 * Status breakdown bar and legend.
 */
export async function StatusDistribution({ segments }: StatusDistributionProps) {
  const lang = await getServerLang();
  const totalDocs = segments.reduce((s, seg) => s + seg.c, 0);
  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
        <ListChecks className="h-4 w-4 text-primary" />{ts(lang, "الحالات")}</h3>
      {totalDocs === 0 ? (
        <EmptyState compact icon={ListChecks} title={ts(lang, "لا مستندات بعد")} description={ts(lang, "تظهر حالات المستندات (نشط، مؤرشف…) عند الإيداع.")} />
      ) : (
        <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            {segments.map((seg) => seg.c > 0 && (
              <div key={seg.s} style={{ width: `${seg.pct}%`, backgroundColor: seg.color }} className="h-full" />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {segments.map((seg) => (
              <div key={seg.s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                {STATUS_META[seg.s].label}
                <span className="font-bold text-foreground">{seg.c}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
