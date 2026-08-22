import { Card } from "@/components/ui";
import { cn, formatBytes } from "@/lib/format";
import { FileText, Building2, Users2, HardDrive } from "lucide-react";
import type { ReportsData } from "@/lib/reports";

export function ReportsSummary({ data }: { data: ReportsData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<FileText className="h-5 w-5" />}
        label="إجمالي المستندات"
        value={data.totalDocs.toLocaleString("ar-EG")}
        color="text-blue-600 dark:text-blue-400"
        bg="bg-blue-500/10"
      />
      <SummaryCard
        icon={<HardDrive className="h-5 w-5" />}
        label="الحجم الإجمالي"
        value={formatBytes(data.totalSize)}
        color="text-emerald-600 dark:text-emerald-400"
        bg="bg-emerald-500/10"
      />
      <SummaryCard
        icon={<Building2 className="h-5 w-5" />}
        label="الأقسام النشطة"
        value={String(data.docsByDept.filter((d) => d.deptId).length)}
        color="text-amber-600 dark:text-amber-400"
        bg="bg-amber-500/10"
      />
      <SummaryCard
        icon={<Users2 className="h-5 w-5" />}
        label="المساهمون"
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
    <Card className="flex items-center gap-4 p-5">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", bg, color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-xl font-bold text-foreground">{value}</div>
      </div>
    </Card>
  );
}
