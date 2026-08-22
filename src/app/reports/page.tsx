import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { getReportsData } from "@/lib/reports";
import { ReportsSummary } from "@/components/reports/reports-summary";
import { ReportsExport } from "@/components/reports/reports-export";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user || !can(user, "reports.view")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h2 className="text-lg font-bold text-foreground">لا تملك صلاحية الوصول</h2>
        <p className="mt-1 text-sm text-muted-foreground">التقارير متاحة فقط للمدراء والمسؤولين.</p>
      </div>
    );
  }

  const data = await getReportsData();

  return (
    <div className="animate-fadein space-y-6">
      <PageHeader
        title="التقارير والإحصائيات"
        subtitle="نظرة تحليلية على بيانات الأرشيف — متاح للمدراء والمسؤولين"
        icon={<FileText className="h-5 w-5" />}
      />

      {/* Summary cards */}
      <ReportsSummary data={data} />

      {/* Export buttons */}
      <ReportsExport />

      {/* ── Interactive client sections (search + filters) ── */}
      <ReportsClient data={data} />
    </div>
  );
}
