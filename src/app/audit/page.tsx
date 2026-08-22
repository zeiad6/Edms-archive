import { History, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { AuditGrid, type AuditRow } from "@/components/grids/audit-grid";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Parse a stored audit timestamp into a real Date.
 *
 * Runtime entries default to SQLite `CURRENT_TIMESTAMP`, which yields the
 * SQLite form `"YYYY-MM-DD HH:MM:SS"` in UTC with no zone marker, while seeded
 * entries are full ISO-8601. The SQLite form is normalized to UTC before
 * parsing so both display in the user's local time consistently — and a
 * corrupt value falls back to the epoch instead of crashing the whole page.
 */
function parseAuditTime(raw: string): Date {
  if (!raw) return new Date(0);
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export default async function AuditPage() {
  // audit.view is admin-only per RBAC — staff must not see the full audit trail.
  const user = await getCurrentUser();
  if (!user || !can(user, "audit.view")) notFound();
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(300);

  const rows: AuditRow[] = logs.map((a) => ({
    id: a.id,
    time: parseAuditTime(a.createdAt),
    user: a.userName,
    action: a.action,
    details: a.details,
  }));

  return (
    <div className="animate-fadein">
      <PageHeader
        title="سجل النشاط"
        subtitle="تتبّع كامل لجميع العمليات على المستندات والنظام (Audit Trail)"
        icon={<History className="h-5 w-5" />}
      />

      <Card className="mb-5 flex items-center gap-3 bg-emerald-500/5 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <p className="text-xs leading-relaxed text-muted-foreground">
          يُسجَّل كل حدث بشكل غير قابل للحذف مع المستخدم والطابع الزمني والتفاصيل. استخدم
          التصفية والفرز والبحث في الجدول أدناه، أو صدّر السجلات إلى CSV للتدقيق الخارجي.
        </p>
      </Card>

      <AuditGrid rows={rows} />
    </div>
  );
}
