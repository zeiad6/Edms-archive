import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { getReportsData } from "@/lib/reports";
import { ReportsSummary } from "@/components/reports/reports-summary";
import { ReportsExport } from "@/components/reports/reports-export";
import { ReportsClient } from "./reports-client";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const lang = await getServerLang();
  const user = await getCurrentUser();
  if (!user || !can(user, "reports.view")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <h2 className="text-xl font-extrabold tracking-tight text-foreground">{ts(lang, "لا تملك صلاحية الوصول")}</h2>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{ts(lang, "التقارير متاحة فقط للمدراء والمسؤولين.")}</p>
      </div>
    );
  }

  const data = await getReportsData();

  return (
    <div className="animate-fadein page-stack">
      <PageHeader
        title={ts(lang, "التقارير والإحصائيات")}
        subtitle={ts(lang, "نظرة تحليلية على بيانات الأرشيف — متاح للمدراء والمسؤولين")}
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
