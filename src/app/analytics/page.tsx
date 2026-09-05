import { redirect } from "next/navigation";
import { MermaidRenderer } from "@/components/mermaid-renderer";
import { EDMS_DIAGRAMS } from "@/lib/edms-diagrams";
import { db } from "@/db";
import {
  documents,
  departments,
  docTypes,
  folders,
  tags,
  documentTags,
  users,
  approvalRequests,
} from "@/db/schema";
import { count, eq, desc, isNull, and, sql } from "drizzle-orm";
import { BarChart3, GitBranch, LayoutGrid, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentUser, canAccessDocument } from "@/lib/server";
import {
  getStatusCount,
  generateMonthDates,
  calculateMonthlyTrend,
  calculateStatusSegments,
  prepareRecentDocuments,
} from "@/lib/dashboard-helpers";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { StatusDistribution } from "@/components/dashboard/status-distribution-card";
import { DepartmentsDistribution } from "@/components/dashboard/departments-distribution-card";
import { DocTypesCard } from "@/components/dashboard/doc-types-card";
import { MonthlyTrendCard } from "@/components/dashboard/monthly-trend-card";
import { PopularTagsCard } from "@/components/dashboard/popular-tags-card";
import { TopUploadersCard } from "@/components/dashboard/top-uploaders-card";
import { RecentDocumentsCard } from "@/components/dashboard/recent-documents-card";
import { FolderStructureCard } from "@/components/analytics/folder-structure-card";
import { WorkflowCard } from "@/components/analytics/workflow-card";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const lang = await getServerLang();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const monthDates = generateMonthDates();

  const [
    totals,
    sizeRow,
    statusRows,
    deptRows,
    typeRows,
    tagStats,
    recentRaw,
    topUploaders,
    folderStats,
    approvalRow,
    monthlyRows,
  ] = await Promise.all([
    // Total documents
    db
      .select({ count: count() })
      .from(documents)
      .where(isNull(documents.deletedAt)),

    // Total storage used
    db
      .select({ size: sql<number>`coalesce(sum(${documents.fileSize}), 0)` })
      .from(documents)
      .where(isNull(documents.deletedAt)),

    // Documents by status
    db
      .select({ status: documents.status, c: sql<number>`CAST(count(*) AS INTEGER)` })
      .from(documents)
      .where(isNull(documents.deletedAt))
      .groupBy(documents.status),

    // Documents per department (with color), departments with 0 docs included
    db
      .select({
        name: departments.name,
        color: departments.color,
        c: sql<number>`CAST(count(${documents.id}) AS INTEGER)`,
      })
      .from(departments)
      .leftJoin(documents, eq(documents.departmentId, departments.id))
      .where(isNull(documents.deletedAt))
      .groupBy(departments.id, departments.name, departments.color)
      .orderBy(desc(sql`count(${documents.id})`)),

    // Documents by type (with color)
    db
      .select({
        type: documents.docType,
        c: sql<number>`CAST(count(*) AS INTEGER)`,
        color: docTypes.color,
      })
      .from(documents)
      .leftJoin(docTypes, eq(documents.docType, docTypes.name))
      .where(isNull(documents.deletedAt))
      .groupBy(documents.docType, docTypes.color)
      .orderBy(desc(sql`count(*)`)),

    // Most-used tags (top 12)
    db
      .select({
        name: tags.name,
        color: tags.color,
        c: sql<number>`CAST(count(${documentTags.tagId}) AS INTEGER)`,
      })
      .from(tags)
      .leftJoin(documentTags, eq(documentTags.tagId, tags.id))
      .groupBy(tags.id, tags.name, tags.color)
      .orderBy(desc(sql`count(${documentTags.tagId})`))
      .limit(12),

    // Latest 5 documents with department + uploader
    db
      .select({
        d: documents,
        deptName: departments.name,
        deptColor: departments.color,
        uploaderName: users.name,
      })
      .from(documents)
      .leftJoin(departments, eq(documents.departmentId, departments.id))
      .leftJoin(users, eq(documents.uploadedById, users.id))
      .where(isNull(documents.deletedAt))
      .orderBy(desc(documents.createdAt))
      .limit(5),

    // Top 5 uploaders
    db
      .select({
        name: users.name,
        avatarColor: users.avatarColor,
        c: sql<number>`CAST(count(*) AS INTEGER)`,
      })
      .from(documents)
      .innerJoin(users, eq(documents.uploadedById, users.id))
      .where(isNull(documents.deletedAt))
      .groupBy(users.id, users.name, users.avatarColor)
      .orderBy(desc(sql`count(*)`))
      .limit(5),

    // Top folders by document count (for the structure tree)
    db
      .select({
        name: folders.name,
        count: count(),
      })
      .from(documents)
      .leftJoin(folders, eq(documents.folderId, folders.id))
      .where(isNull(documents.deletedAt))
      .groupBy(folders.name)
      .orderBy(desc(count()))
      .limit(8),

    // Pending approvals assigned to the current user
    db
      .select({ c: count() })
      .from(approvalRequests)
      .where(
        sql`${approvalRequests.assignedToId} = ${user.id} AND ${approvalRequests.status} = 'pending'`
      ),

    // Monthly trend: docs per month over the last 6 months — one GROUP BY query
    // (was 6 per-month COUNT round-trips); the 6 buckets are filled in JS below.
    db
      .select({
        m: sql<string>`strftime('%Y-%m', ${documents.createdAt})`,
        c: sql<number>`CAST(count(*) AS INTEGER)`,
      })
      .from(documents)
      .where(
        and(sql`${documents.createdAt} >= ${monthDates[0].start}`, isNull(documents.deletedAt))
      )
      .groupBy(sql`strftime('%Y-%m', ${documents.createdAt})`),
  ]);

  // Fill the 6 monthly buckets from the single grouped query (missing → 0),
  // keeping the same order/shape the chart helpers expect.
  const monthCounts = new Map(monthlyRows.map((r): [string, number] => [r.m, r.c]));
  const monthlyRaw = monthDates.map((m) => monthCounts.get(m.start.slice(0, 7)) ?? 0);

  const { months, monthlyMax } = calculateMonthlyTrend(monthlyRaw);

  const total = totals[0]?.count ?? 0;
  const storage = Number(sizeRow[0]?.size ?? 0);
  const pendingApprovalsCount = Number(approvalRow[0]?.c ?? 0);
  const statusCounts = statusRows.map((r) => ({ status: r.status, c: Number(r.c) }));
  const statusSegments = calculateStatusSegments(statusCounts, total);
  const recent = prepareRecentDocuments(recentRaw, user, canAccessDocument);

  // Build Mermaid diagram definitions (shared module — server-safe)
  const folderTreeDef = EDMS_DIAGRAMS.folderTree(
    folderStats.map((f) => ({
      // Show per-folder document counts inside the tree labels
      name: `${f.name || ts(lang, "مجلد غير مسمى")} (${f.count})`,
      children: [],
    }))
  );

  return (
    <div className="animate-fadein page-stack">
      <PageHeader
        title={ts(lang, "لوحة تحليلات الأرشيف")}
        subtitle={ts(lang, "نظرة شاملة على الأرشيف: التوزيعات، الاتجاهات، الهيكل، ونشاط الإيداع")}
        icon={<BarChart3 className="h-5 w-5" />}
      />

      {/* KPI summary bar (same pattern as the main dashboard) */}
      <DashboardKpis
        total={total}
        active={getStatusCount(statusCounts, "active")}
        pendingReview={getStatusCount(statusCounts, "pending_review")}
        archived={getStatusCount(statusCounts, "archived")}
        pendingApprovalsCount={pendingApprovalsCount}
        storage={storage}
      />

      {/* ── Section: distributions ── */}
      <section className="space-y-5">
        <h2 className="flex items-center gap-2.5 text-sm font-extrabold tracking-tight text-foreground after:ms-3 after:h-px after:flex-1 after:bg-gradient-to-l after:from-border after:to-transparent after:content-['']">
          <span className="icon-tile h-8 w-8 rounded-xl"><LayoutGrid className="h-4 w-4" /></span>{ts(lang, "التوزيعات")}</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6 2xl:grid-cols-3">
          <DepartmentsDistribution byDept={deptRows} />
          <StatusDistribution segments={statusSegments} />
          <DocTypesCard typeRows={typeRows} total={total} />
        </div>
      </section>

      {/* ── Section: trend & activity ── */}
      <section className="space-y-5">
        <h2 className="flex items-center gap-2.5 text-sm font-extrabold tracking-tight text-foreground after:ms-3 after:h-px after:flex-1 after:bg-gradient-to-l after:from-border after:to-transparent after:content-['']">
          <span className="icon-tile h-8 w-8 rounded-xl"><TrendingUp className="h-4 w-4" /></span>{ts(lang, "الاتجاه والنشاط")}</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">
          <MonthlyTrendCard months={months} raw={monthlyRaw} max={monthlyMax} />
          <PopularTagsCard tagStats={tagStats} />
          <TopUploadersCard uploaders={topUploaders} total={total} />
        </div>
      </section>

      {/* ── Section: recent docs + folder structure ── */}
      <section className="space-y-5">
        <h2 className="flex items-center gap-2.5 text-sm font-extrabold tracking-tight text-foreground after:ms-3 after:h-px after:flex-1 after:bg-gradient-to-l after:from-border after:to-transparent after:content-['']">
          <span className="icon-tile h-8 w-8 rounded-xl"><GitBranch className="h-4 w-4" /></span>{ts(lang, "الأرشيف الحديث والهيكل")}</h2>
        <div className="grid grid-cols-1 gap-5 lg:gap-6 xl:grid-cols-3">
          <RecentDocumentsCard recent={recent} />
          <FolderStructureCard folders={folderStats.map((f) => ({ name: f.name ?? ts(lang, "مجلد غير مسمى"), count: f.count }))} />
        </div>
      </section>

      {/* ── Section: document workflow (Mermaid sequence) ── */}
      <WorkflowCard />
    </div>
  );
}
