import { db } from "@/db";
import { documents, departments, users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

/* ── Types (shared with src/app/reports/reports-client.tsx) ── */

export interface DeptRow {
  deptId: number | null;
  deptName: string | null;
  deptColor: string | null;
  count: number;
  size: number;
}

export interface TypeRow {
  type: string;
  count: number;
  size: number;
}

export interface UserRow {
  userId: number;
  userName: string | null;
  userColor: string | null;
  count: number;
  size: number;
}

export interface MonthlyRow {
  month: string;
  count: number;
}

export interface StatusRow {
  status: string | null;
  count: number;
}

export interface ReportsData {
  totalDocs: number;
  totalSize: number;
  docsByDept: DeptRow[];
  docsByUser: UserRow[];
  byType: TypeRow[];
  byStatus: StatusRow[];
  monthly: MonthlyRow[];
}

/* ── Data layer ────────────────────────────────────────────── */

export async function getReportsData(): Promise<ReportsData> {
  const [totalDocs, totalSize, docsByDept, docsByUser, byType, byStatus, monthly] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(documents).then((r) => Number(r[0]?.count ?? 0)),
    db
      .select({ total: sql<number>`coalesce(sum(file_size),0)` })
      .from(documents)
      .then((r) => Number(r[0]?.total ?? 0)),
    db
      .select({
        deptId: departments.id,
        deptName: departments.name,
        deptColor: departments.color,
        count: sql<number>`count(*)`,
        size: sql<number>`coalesce(sum(${documents.fileSize}),0)`,
      })
      .from(documents)
      .leftJoin(departments, eq(documents.departmentId, departments.id))
      .groupBy(documents.departmentId)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        userId: users.id,
        userName: users.name,
        userColor: users.avatarColor,
        count: sql<number>`count(*)`,
        size: sql<number>`coalesce(sum(${documents.fileSize}),0)`,
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedById, users.id))
      .groupBy(documents.uploadedById)
      .orderBy(desc(sql`count(*)`))
      .limit(20),
    db
      .select({
        type: documents.docType,
        count: sql<number>`count(*)`,
        size: sql<number>`coalesce(sum(${documents.fileSize}),0)`,
      })
      .from(documents)
      .where(sql`${documents.docType} IS NOT NULL`)
      .groupBy(documents.docType)
      .orderBy(desc(sql`count(*)`)),
    /* ── status distribution ──────────────────────────── */
    db
      .select({ status: documents.status, count: sql<number>`count(*)` })
      .from(documents)
      .where(sql`${documents.status} IS NOT NULL`)
      .groupBy(documents.status)
      .orderBy(desc(sql`count(*)`)),
    /* ── monthly upload trend ─────────────────────────── */
    db
      .select({
        month: sql<string>`strftime('%Y-%m', ${documents.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(documents)
      .groupBy(sql`strftime('%Y-%m', ${documents.createdAt})`)
      .orderBy(sql`strftime('%Y-%m', ${documents.createdAt})`),
  ]);

  return {
    totalDocs: Number(totalDocs),
    totalSize: Number(totalSize),
    docsByDept: docsByDept.map((d) => ({
      deptId: d.deptId,
      deptName: d.deptName,
      deptColor: d.deptColor,
      count: Number(d.count),
      size: Number(d.size),
    })),
    docsByUser: docsByUser.map((u) => ({
      userId: Number(u.userId),
      userName: u.userName,
      userColor: u.userColor,
      count: Number(u.count),
      size: Number(u.size),
    })),
    byType: byType.map((t) => ({
      type: t.type ?? "غير محدد",
      count: Number(t.count),
      size: Number(t.size),
    })),
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: Number(s.count),
    })),
    monthly: monthly.map((m) => ({
      month: String(m.month),
      count: Number(m.count),
    })),
  };
}
