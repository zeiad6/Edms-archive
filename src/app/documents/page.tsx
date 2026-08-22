import { Files, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { documents, departments, folders, docTypes } from "@/db/schema";
import type { Document } from "@/db/schema";
import { eq, desc, sql, or, and, asc, isNull } from "drizzle-orm";
import { getCurrentUser, canAccessDocument } from "@/lib/server";
import { ensureSeeded } from "@/lib/seed";
import { Card, PageHeader } from "@/components/ui";
import { DocumentsPageClient, CsvExportButton } from "@/components/documents-page-client";
import type { DocRow } from "@/components/grids/documents-grid";
import { STATUS_META, sanitizeLikeQuery } from "@/lib/format";

export const dynamic = "force-dynamic";

type DocStatus = "active" | "pending_review" | "archived" | "draft";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; dept?: string; type?: string; folder?: string }>;
}) {
  await ensureSeeded();
  const user = await getCurrentUser();
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const status = sp.status || "";
  const dept = sp.dept ? Number(sp.dept) : null;
  const type = sp.type || "";
  const folder = sp.folder ? Number(sp.folder) : null;

  const conds: (ReturnType<typeof sql> | undefined)[] = [sql`${documents.deletedAt} IS NULL`];
  if (q) {
    const like = sanitizeLikeQuery(q);
    conds.push(
      or(
        sql`${documents.title} LIKE ${like} ESCAPE '\\'`,
        sql`${documents.description} LIKE ${like} ESCAPE '\\'`,
        sql`${documents.contentText} LIKE ${like} ESCAPE '\\'`,
        sql`${documents.docNumber} LIKE ${like} ESCAPE '\\'`,
        sql`${documents.docType} LIKE ${like} ESCAPE '\\'`
      )
    );
  }
  if (status) conds.push(eq(documents.status, status as DocStatus));
  if (dept) conds.push(eq(documents.departmentId, dept));
  if (type) conds.push(eq(documents.docType, type));
  if (folder) conds.push(eq(documents.folderId, folder));
  if (user && user.role !== "admin") {
    conds.push(or(eq(documents.departmentId, user.departmentId ?? -1), eq(documents.uploadedById, user.id)));
    if (user.role === "staff") conds.push(eq(documents.confidential, 0));
  }

  // Documents query + filter options are independent — run them in one parallel batch
  // (was 2 sequential round-trips; now 1).
  // Select only the columns DocRow consumes — not the full row (no content_text,
  // description, storage refs). folders join was unused downstream — dropped.
  const [raw, allDepts, allFolders, allDocTypes] = await Promise.all([
    db
      .select({
        d: {
          id: documents.id,
          title: documents.title,
          docNumber: documents.docNumber,
          docType: documents.docType,
          status: documents.status,
          confidential: documents.confidential,
          departmentId: documents.departmentId,
          uploadedById: documents.uploadedById,
          fileSize: documents.fileSize,
          createdAt: documents.createdAt,
        },
        deptName: departments.name,
        deptColor: departments.color,
        docTypeColor: docTypes.color,
      })
      .from(documents)
      .leftJoin(departments, eq(documents.departmentId, departments.id))
      .leftJoin(docTypes, eq(documents.docType, docTypes.name))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(documents.createdAt))
      .limit(1000),
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(departments.name),
    db.select({ id: folders.id, name: folders.name }).from(folders).orderBy(folders.name),
    db.select({ id: docTypes.id, name: docTypes.name }).from(docTypes).orderBy(asc(docTypes.sortOrder)),
  ]);

  const rows: DocRow[] = raw
    .filter((r) => canAccessDocument(user, r.d as Document))
    .map((r) => ({
      id: r.d.id,
      title: r.d.title,
      docNumber: r.d.docNumber,
      docType: r.d.docType,
      docTypeColor: r.docTypeColor,
      status: r.d.status,
      departmentName: r.deptName,
      departmentColor: r.deptColor,
      fileSize: r.d.fileSize,
      confidential: r.d.confidential ? true : false,
      date: typeof r.d.createdAt === "string" ? r.d.createdAt : new Date(r.d.createdAt).toISOString(),
    }));

  const hasFilters = !!(q || status || dept || type || folder);

  return (
    <div className="flex min-h-0 flex-1 animate-fadein flex-col">
      <PageHeader
        title="المستندات"
        subtitle="سجل تفاعلي للمستندات — فرز وبحث وتصدير وترقيم صفحات"
        icon={<Files className="h-5 w-5" />}
      />

      <Card className="mb-3 shrink-0 p-3.5">
        <form method="get" action="/documents" className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder="بحث في العنوان أو المحتوى أو الرقم..."
              className="w-full rounded-xl border border-border bg-muted py-2.5 ps-10 pe-3 text-sm text-foreground outline-none focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <Select name="status" value={status} options={[["", "كل الحالات"], ...Object.entries(STATUS_META).map(([k, v]) => [k, v.label] as [string, string])]} />
          <Select name="dept" value={dept ? String(dept) : ""} options={[["", "كل الأقسام"], ...allDepts.map((d) => [String(d.id), d.name] as [string, string])]} />
          <Select name="type" value={type} options={[["", "كل الأنواع"], ...allDocTypes.map((t) => [t.name, t.name] as [string, string])]} />
          <Select name="folder" value={folder ? String(folder) : ""} options={[["", "كل المجلدات"], ...allFolders.map((f) => [String(f.id), f.name] as [string, string])]} />
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
            <SlidersHorizontal className="h-4 w-4" /> تصفية
          </button>
          {hasFilters && (
            <Link href="/documents" className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted">
              <X className="h-4 w-4" /> مسح
            </Link>
          )}
          <CsvExportButton />
        </form>
      </Card>

      <DocumentsPageClient rows={rows} />
    </div>
  );
}

function Select({
  name,
  value,
  options,
}: {
  name: string;
  value: string;
  options: [string, string][];
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      className="rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
