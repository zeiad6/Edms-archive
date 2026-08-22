import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  documents,
  departments,
  users,
  folders,
  docTypes,
} from "@/db/schema";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** UTF-8 BOM so Excel opens Arabic CSV correctly */
const BOM = "\uFEFF";

const esc = (v: string | number | null | undefined): string => {
  const s = String(v ?? "");
  // CSV injection guard: neutralize formula-prefix cells (=, +, -, @)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
};

const csv = (headers: string[], rows: string[][]): string =>
  [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");

const statusLabel: Record<string, string> = {
  draft: "مسودة",
  pending_review: "قيد المراجعة",
  active: "نشط",
  archived: "مؤرشف",
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("غير مصرّح", { status: 401 });
  }
  if (!can(user, "reports.view")) {
    return new NextResponse("غير مصرّح", { status: 403 });
  }

  const type = request.nextUrl.searchParams.get("type") || "depts";

  /* ── Departments ────────────────────────────── */
  if (type === "depts") {
    const rows = await db
      .select({
        deptName: departments.name,
        count: sql<number>`count(*)`,
        size: sql<number>`coalesce(sum(${documents.fileSize}),0)`,
      })
      .from(documents)
      .leftJoin(departments, eq(documents.departmentId, departments.id))
      .groupBy(documents.departmentId)
      .orderBy(desc(sql`count(*)`));

    const body = csv(
      ["القسم", "عدد المستندات", "الحجم (بايت)"],
      rows.map((r) => [r.deptName || "بدون قسم", String(r.count), String(r.size)])
    );

    return new NextResponse(BOM + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="تقرير-الأقسام.csv"`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    });
  }

  /* ── Users ──────────────────────────────────── */
  if (type === "users") {
    const rows = await db
      .select({
        userName: users.name,
        userEmail: users.email,
        jobTitle: users.jobTitle,
        count: sql<number>`count(*)`,
        size: sql<number>`coalesce(sum(${documents.fileSize}),0)`,
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedById, users.id))
      .groupBy(documents.uploadedById)
      .orderBy(desc(sql`count(*)`));

    const body = csv(
      ["المستخدم", "البريد", "المسمى", "عدد المستندات", "الحجم (بايت)"],
      rows.map((r) => [
        r.userName || "غير معروف",
        r.userEmail || "",
        r.jobTitle || "",
        String(r.count),
        String(r.size),
      ])
    );

    return new NextResponse(BOM + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="تقرير-المستخدمين.csv"`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    });
  }

  /* ── Document types ─────────────────────────── */
  if (type === "types") {
    const rows = await db
      .select({
        docType: documents.docType,
        count: sql<number>`count(*)`,
        size: sql<number>`coalesce(sum(${documents.fileSize}),0)`,
      })
      .from(documents)
      .where(sql`${documents.docType} IS NOT NULL`)
      .groupBy(documents.docType)
      .orderBy(desc(sql`count(*)`));

    const body = csv(
      ["نوع المستند", "العدد", "الحجم (بايت)"],
      rows.map((r) => [r.docType!, String(r.count), String(r.size)])
    );

    return new NextResponse(BOM + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="تقرير-أنواع-المستندات.csv"`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    });
  }

  /* ── Status ─────────────────────────────────── */
  if (type === "status") {
    const rows = await db
      .select({
        status: documents.status,
        count: sql<number>`count(*)`,
        size: sql<number>`coalesce(sum(${documents.fileSize}),0)`,
      })
      .from(documents)
      .groupBy(documents.status)
      .orderBy(desc(sql`count(*)`));

    const body = csv(
      ["الحالة", "العدد", "الحجم (بايت)"],
      rows.map((r) => [statusLabel[r.status] || r.status, String(r.count), String(r.size)])
    );

    return new NextResponse(BOM + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="تقرير-حالة-المستندات.csv"`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    });
  }

  /* ── Folders ────────────────────────────────── */
  if (type === "folders") {
    const rows = await db
      .select({
        folderId: folders.id,
        folderName: folders.name,
        deptName: departments.name,
        count: sql<number>`count(*)`,
        size: sql<number>`coalesce(sum(${documents.fileSize}),0)`,
      })
      .from(documents)
      .leftJoin(folders, eq(documents.folderId, folders.id))
      .leftJoin(departments, eq(folders.departmentId, departments.id))
      .where(sql`${documents.folderId} IS NOT NULL`)
      .groupBy(documents.folderId)
      .orderBy(desc(sql`count(*)`));

    const body = csv(
      ["المجلد", "القسم", "عدد المستندات", "الحجم (بايت)"],
      rows.map((r) => [r.folderName || "بدون اسم", r.deptName || "", String(r.count), String(r.size)])
    );

    return new NextResponse(BOM + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="تقرير-المجلدات.csv"`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    });
  }

  /* ── Full document list ─────────────────────── */
  if (type === "documents") {
    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        docNumber: documents.docNumber,
        docType: documents.docType,
        status: documents.status,
        confidential: documents.confidential,
        deptName: departments.name,
        folderName: folders.name,
        uploaderName: users.name,
        fileExt: documents.fileExt,
        fileSize: documents.fileSize,
        pageCount: documents.pageCount,
        version: documents.version,
        ocrProcessed: documents.ocrProcessed,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        docDate: documents.docDate,
      })
      .from(documents)
      .leftJoin(departments, eq(documents.departmentId, departments.id))
      .leftJoin(folders, eq(documents.folderId, folders.id))
      .leftJoin(users, eq(documents.uploadedById, users.id))
      .where(isNull(documents.deletedAt))
      .orderBy(desc(documents.createdAt));

    const body = csv(
      [
        "المعرف",
        "العنوان",
        "رقم المستند",
        "النوع",
        "الحالة",
        "سري",
        "القسم",
        "المجلد",
        "رفعه",
        "الصيغة",
        "الحجم (بايت)",
        "عدد الصفحات",
        "الإصدار",
        "تمت المعالجة (OCR)",
        "تاريخ الإنشاء",
        "آخر تحديث",
        "تاريخ المستند",
      ],
      rows.map((r) => [
        String(r.id),
        r.title,
        r.docNumber || "",
        r.docType || "",
        statusLabel[r.status] || r.status,
        r.confidential ? "نعم" : "لا",
        r.deptName || "",
        r.folderName || "",
        r.uploaderName || "",
        r.fileExt || "",
        String(r.fileSize),
        String(r.pageCount ?? 1),
        String(r.version),
        r.ocrProcessed ? "نعم" : "لا",
        r.createdAt,
        r.updatedAt,
        r.docDate || "",
      ])
    );

    return new NextResponse(BOM + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="جميع-المستندات.csv"`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    });
  }

  return new NextResponse("نوع التقرير غير معروف", { status: 400 });
}
