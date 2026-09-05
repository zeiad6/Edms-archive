import { db } from "@/db";
import { documents, departments, users, auditLogs, approvalRequests, tags, documentTags, docTypes } from "@/db/schema";
import { count, eq, and, desc, sql, isNull } from "drizzle-orm";
import { getCurrentUser, canAccessDocument } from "@/lib/server";
import { ensureSeeded } from "@/lib/seed";
import { getStatusCount, generateMonthDates, calculateMonthlyTrend, calculateStatusSegments, getGreeting, getTodayFormatted, prepareRecentDocuments } from "@/lib/dashboard-helpers";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { RecentDocumentsCard } from "@/components/dashboard/recent-documents-card";
import { ActivityFeedCard } from "@/components/dashboard/activity-feed-card";
import { DepartmentsDistribution } from "@/components/dashboard/departments-distribution-card";
import { StorageUsageCard } from "@/components/dashboard/storage-usage-card";
import { StatusDistribution } from "@/components/dashboard/status-distribution-card";
import { MonthlyTrendCard } from "@/components/dashboard/monthly-trend-card";
import { PopularTagsCard } from "@/components/dashboard/popular-tags-card";
import { DocTypesCard } from "@/components/dashboard/doc-types-card";
import { TopUploadersCard } from "@/components/dashboard/top-uploaders-card";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await ensureSeeded();
  const user = await getCurrentUser();

  // All dashboard queries are independent — run them in a single parallel batch
  // (was 7 sequential round-trips; now 1).
  const monthDates = generateMonthDates();

  const [
    totals,
    weekRow,
    statusRows,
    sizeRow,
    pendingApprovalsCount,
    monthlyRows,
    tagStats,
    typeRows,
    topUploaders,
    byDept,
    recentRaw,
    activity,
  ] = await Promise.all([
    db.select({ total: count() }).from(documents).where(isNull(documents.deletedAt)),
    db
      .select({ c: count() })
      .from(documents)
      .where(
        and(
          sql`${documents.createdAt} > ${new Date(Date.now() - 7 * 86400000).toISOString()}`,
          isNull(documents.deletedAt)
        )
      ),
    db.select({ status: documents.status, c: count() }).from(documents).where(isNull(documents.deletedAt)).groupBy(documents.status),
    db
      .select({ size: sql<string>`coalesce(sum(${documents.fileSize}), 0)` })
      .from(documents)
      .where(isNull(documents.deletedAt)),
    user
      ? db
          .select({ c: count() })
          .from(approvalRequests)
          .where(and(eq(approvalRequests.assignedToId, user.id), eq(approvalRequests.status, "pending")))
          .then((r) => Number(r[0]?.c ?? 0))
      : Promise.resolve(0),
    // Monthly trend: docs per month over last 6 months — one GROUP BY query
    // (was 6 per-month COUNT round-trips); the 6 buckets are filled in JS below.
    db
      .select({
        m: sql<string>`strftime('%Y-%m', ${documents.createdAt})`,
        c: sql<number>`CAST(count(*) AS INTEGER)`,
      })
      .from(documents)
      .where(
        and(
          sql`${documents.createdAt} >= ${monthDates[0].start}`,
          isNull(documents.deletedAt)
        )
      )
      .groupBy(sql`strftime('%Y-%m', ${documents.createdAt})`),
    // Tags cloud
    db
      .select({ name: tags.name, color: tags.color, c: sql<number>`CAST(count(${documentTags.tagId}) AS INTEGER)` })
      .from(tags)
      .leftJoin(documentTags, eq(documentTags.tagId, tags.id))
      .groupBy(tags.id, tags.name, tags.color)
      .orderBy(desc(sql`count(${documentTags.tagId})`))
      .limit(12),
    // Doc type distribution
    db
      .select({ type: documents.docType, c: sql<number>`CAST(count(*) AS INTEGER)`, color: docTypes.color })
      .from(documents)
      .leftJoin(docTypes, eq(documents.docType, docTypes.name))
      .where(isNull(documents.deletedAt))
      .groupBy(documents.docType, docTypes.color)
      .orderBy(desc(sql`count(*)`)),
    // Top uploaders
    db
      .select({ name: users.name, avatarColor: users.avatarColor, c: sql<number>`CAST(count(*) AS INTEGER)` })
      .from(documents)
      .innerJoin(users, eq(documents.uploadedById, users.id))
      .where(isNull(documents.deletedAt))
      .groupBy(users.id, users.name, users.avatarColor)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    db
      .select({ name: departments.name, color: departments.color, c: sql<number>`CAST(count(${documents.id}) AS INTEGER)` })
      .from(departments)
      .leftJoin(documents, eq(documents.departmentId, departments.id))
      .where(isNull(documents.deletedAt))
      .groupBy(departments.id, departments.name, departments.color)
      .orderBy(desc(sql`count(${documents.id})`)),
    db
      .select({ d: documents, deptName: departments.name, deptColor: departments.color, uploaderName: users.name })
      .from(documents)
      .leftJoin(departments, eq(documents.departmentId, departments.id))
      .leftJoin(users, eq(documents.uploadedById, users.id))
      .where(isNull(documents.deletedAt))
      .orderBy(desc(documents.createdAt))
      .limit(10),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(7),
  ]);

  // Fill the 6 monthly buckets from the single grouped query (missing → 0),
  // keeping the same order/shape the chart helpers expect.
  const monthCounts = new Map(monthlyRows.map((r): [string, number] => [r.m, r.c]));
  const monthlySeries = monthDates.map((m) => monthCounts.get(m.start.slice(0, 7)) ?? 0);

  const { months, monthlyMax } = calculateMonthlyTrend(monthlySeries);

  const recent = prepareRecentDocuments(recentRaw, user, canAccessDocument);

  const total = totals[0]?.total ?? 0;
  const week = weekRow[0]?.c ?? 0;
  const storage = Number(sizeRow[0]?.size ?? 0);

  const statusSegments = calculateStatusSegments(statusRows, total);
  const greeting = getGreeting();
  const today = getTodayFormatted();

  return (
    <div className="animate-fadein page-stack">
      <DashboardHero
        greeting={greeting}
        name={user?.name?.split(" ")[0] ?? ""}
        today={today}
        total={total}
        active={getStatusCount(statusRows, "active")}
        week={week}
      />

      <DashboardKpis
        total={total}
        active={getStatusCount(statusRows, "active")}
        pendingReview={getStatusCount(statusRows, "pending_review")}
        archived={getStatusCount(statusRows, "archived")}
        pendingApprovalsCount={pendingApprovalsCount}
        storage={storage}
      />

      {/* Recent + Activity: fill the row proportionally (2:1 on lg+ screens) */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <RecentDocumentsCard recent={recent} />
        <ActivityFeedCard activity={activity} />
      </div>

      {/* Distribution cards: auto-fit so they fill the width at every size */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <DepartmentsDistribution byDept={byDept} />
        <div className="space-y-5 lg:space-y-6">
          <StorageUsageCard storage={storage} />
          <StatusDistribution segments={statusSegments} />
        </div>
      </div>

      {/* Three chart cards side by side on wide screens */}
      <div className="stagger grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <MonthlyTrendCard months={months} raw={monthlySeries} max={monthlyMax} />
        <PopularTagsCard tagStats={tagStats} />
        <DocTypesCard typeRows={typeRows} total={total} />
      </div>

      <TopUploadersCard uploaders={topUploaders} total={total} />
    </div>
  );
}
