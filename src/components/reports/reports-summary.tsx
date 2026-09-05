import { Card } from "@/components/ui";
import { cn, formatBytes } from "@/lib/format";
import { FileText, Building2, Users2, HardDrive } from "lucide-react";
import type { ReportsData } from "@/lib/reports";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export async function ReportsSummary({ data }: { data: ReportsData }) {
  const lang = await getServerLang();
  return (
    <div className="stat-grid stagger">
      <SummaryCard
        icon={<FileText className="h-5 w-5" />}
        label={ts(lang, "إجمالي المستندات")}
        value={data.totalDocs.toLocaleString(lang === "en" ? "en-US" : "ar-EG")}
        color="text-blue-600 dark:text-blue-400"
        bg="bg-blue-500/10"
      />
      <SummaryCard
        icon={<HardDrive className="h-5 w-5" />}
        label={ts(lang, "الحجم الإجمالي")}
        value={formatBytes(data.totalSize)}
        color="text-emerald-600 dark:text-emerald-400"
        bg="bg-emerald-500/10"
      />
      <SummaryCard
        icon={<Building2 className="h-5 w-5" />}
        label={ts(lang, "الأقسام النشطة")}
        value={String(data.docsByDept.filter((d) => d.deptId).length)}
        color="text-amber-600 dark:text-amber-400"
        bg="bg-amber-500/10"
      />
      <SummaryCard
        icon={<Users2 className="h-5 w-5" />}
        label={ts(lang, "المساهمون")}
        value={String(data.docsByUser.length)}
        color="text-violet-600 dark:text-violet-400"
        bg="bg-violet-500/10"
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <Card className="card-interactive card-sheen flex items-center gap-4 p-5 shadow-card">
      <div className={cn("icon-tile h-12 w-12", bg, color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-xl font-bold tnum text-foreground">{value}</div>
      </div>
    </Card>
  );
}
