import { Archive, ClipboardCheck, Clock4, FileCheck2, Files, HardDrive } from "lucide-react";
import { StatCard } from "@/components/ui";
import { formatBytes } from "@/lib/format";

interface DashboardKpisProps {
  total: number;
  active: number;
  pendingReview: number;
  archived: number;
  pendingApprovalsCount: number;
  storage: number;
}

/**
 * KPI stat cards row of the dashboard.
 */
export function DashboardKpis({
  total,
  active,
  pendingReview,
  archived,
  pendingApprovalsCount,
  storage,
}: DashboardKpisProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <StatCard icon={<Files className="h-5 w-5" />} label="إجمالي المستندات" value={total} hint="مؤرشفة في النظام" accent="indigo" />
      <StatCard icon={<FileCheck2 className="h-5 w-5" />} label="مستندات سارية" value={active} hint="معتمدة ونافذة" accent="emerald" />
      <StatCard icon={<Clock4 className="h-5 w-5" />} label="قيد المراجعة" value={pendingReview} hint="بانتظار الاعتماد" accent="amber" delta={pendingReview > 0 ? { value: "تحتاج إجراء" } : undefined} />
      <StatCard icon={<Archive className="h-5 w-5" />} label="مؤرشفة" value={archived} hint="محفوظة طويلة الأمد" accent="sky" />
      <StatCard icon={<ClipboardCheck className="h-5 w-5" />} label="موافقات معلقة" value={pendingApprovalsCount} hint="مطلوب ردك" accent="amber" />
      <StatCard icon={<HardDrive className="h-5 w-5" />} label="حجم التخزين" value={formatBytes(storage)} hint="في التخزين المحلي" accent="violet" />
    </div>
  );
}
