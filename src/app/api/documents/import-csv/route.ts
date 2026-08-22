import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  documents,
  documentVersions,
  documentTags,
  departments,
  folders,
  tags,
  docTypes,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser, logAudit, genKey, writeKey } from "@/lib/server";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ImportRow {
  [column: string]: string | undefined;
}

interface ColumnMapping {
  title?: string;
  description?: string;
  docNumber?: string;
  docType?: string;
  department?: string;
  folder?: string;
  status?: string;
  confidential?: string;
  tags?: string;
  docDate?: string;
}

interface ResolvedRow {
  title: string;
  description: string | null;
  docNumber: string | null;
  docTypeVal: string | null;
  docTypeIdVal: number | null;
  status: "draft" | "pending_review" | "active" | "archived";
  confidential: number;
  docDate: string;
  deptId: number | null;
  folderId: number | null;
  tagsRaw: string;
}

interface LookupCache {
  deptCache: Map<string, number>;
  /** folder name → folder id + owning department (null = legacy/global folder) */
  folderCache: Map<string, { id: number; departmentId: number | null }>;
  docTypeCache: Map<string, number>;
  tagIdCache: Map<string, number>;
  allDocTypes: { id: number; name: string }[];
}

/* ─────────────────── Lookups ─────────────────── */

/** Pre-load all reference tables into memory for O(1) lookups. */
async function buildLookupCache(): Promise<LookupCache> {
  const [allDepts, allFolders, allDocTypes, allTags] = await Promise.all([
    db.select().from(departments),
    db.select().from(folders),
    db.select().from(docTypes),
    db.select().from(tags),
  ]);

  const deptCache = new Map<string, number>();
  for (const d of allDepts) {
    deptCache.set(d.name.toLowerCase(), d.id);
    if (d.nameEn) deptCache.set(d.nameEn.toLowerCase(), d.id);
  }

  const folderCache = new Map<string, { id: number; departmentId: number | null }>();
  for (const f of allFolders)
    folderCache.set(f.name.toLowerCase(), { id: f.id, departmentId: f.departmentId });

  const docTypeCache = new Map<string, number>();
  for (const dt of allDocTypes) docTypeCache.set(dt.name.toLowerCase(), dt.id);

  const tagIdCache = new Map<string, number>();
  for (const t of allTags) tagIdCache.set(t.name.toLowerCase(), t.id);

  return { deptCache, folderCache, docTypeCache, tagIdCache, allDocTypes };
}

/* ─────────────── Row resolution ──────────────── */

/** Parse a single CSV row into a typed, validated record. Returns null when the row is invalid. */
function resolveRow(
  row: ImportRow,
  mapping: ColumnMapping,
  lookups: LookupCache,
  userDepartmentId: number | null,
  today: string,
  canSetStatus: boolean,
  canSetDepartment: boolean,
): ResolvedRow | string {
  const title = mapping.title ? (row[mapping.title] || "").trim() : "";
  if (!title) return "العنوان مطلوب";

  // Department policy (unified with upload): only users with documents.update_all
  // may target a department from the CSV column. For everyone else the CSV
  // department column is ignored and the document is forced into the importer's
  // own department — a staff user can no longer inject another department's
  // name to create documents in a department they don't own.
  let deptId: number | null = null;
  if (canSetDepartment) {
    const deptVal = mapping.department ? (row[mapping.department] || "").trim() : "";
    if (deptVal) {
      const foundDeptId = lookups.deptCache.get(deptVal.toLowerCase());
      if (foundDeptId) {
        deptId = foundDeptId;
      } else {
        // Explicit department name that does not exist: reject the row instead
        // of silently falling back to the importer's own department, which
        // would route the document into an unintended department.
        return `القسم "${deptVal}" غير موجود`;
      }
    }
  } else {
    // Staff (no documents.update_all): the CSV department column is ignored —
    // the document is forced into the importer's own department.
    deptId = userDepartmentId;
  }

  // Folder ownership (unified with upload): the folder must belong to the
  // target department, or be a legacy/global folder (departmentId = null).
  // A row pointing at another department's folder is rejected with a clear
  // error instead of silently importing into the wrong place.
  const folderVal = mapping.folder ? (row[mapping.folder] || "").trim() : "";
  let folderId: number | null = null;
  if (folderVal) {
    const folder = lookups.folderCache.get(folderVal.toLowerCase()) ?? null;
    if (folder) {
      if (folder.departmentId !== null && folder.departmentId !== deptId) {
        return "المجلد لا ينتمي إلى القسم المحدد";
      }
      folderId = folder.id;
    }
  }

  const docTypeRaw = mapping.docType ? (row[mapping.docType] || "").trim() : "";
  let docTypeVal: string | null = null;
  let docTypeIdVal: number | null = null;
  if (docTypeRaw) {
    const dtId = lookups.docTypeCache.get(docTypeRaw.toLowerCase());
    if (dtId) {
      const dt = lookups.allDocTypes.find((d) => d.id === dtId);
      docTypeVal = dt?.name ?? docTypeRaw;
      docTypeIdVal = dtId;
    } else {
      docTypeVal = docTypeRaw;
    }
  }

  // Status policy (unified with upload): staff can never publish directly —
  // imported documents always land in pending_review. Only users with
  // documents.update_all may set the status from the CSV column.
  const statusRaw = mapping.status ? (row[mapping.status] || "").trim().toLowerCase() : "";
  const status: "draft" | "pending_review" | "active" | "archived" = canSetStatus
    ? ["draft", "pending_review", "active", "archived"].includes(statusRaw)
      ? (statusRaw as typeof status)
      : "active"
    : "pending_review";

  const confidentialRaw = mapping.confidential
    ? (row[mapping.confidential] || "").trim().toLowerCase()
    : "";
  const confidential =
    confidentialRaw === "yes" || confidentialRaw === "نعم" || confidentialRaw === "1" ? 1 : 0;

  return {
    title,
    description: mapping.description ? (row[mapping.description] || "").trim() || null : null,
    docNumber: mapping.docNumber ? (row[mapping.docNumber] || "").trim() || null : null,
docTypeVal,
    docTypeIdVal,
    status,
    confidential,
    docDate: mapping.docDate ? (row[mapping.docDate] || "").trim() || today : today,
    deptId,
    folderId,
    tagsRaw: mapping.tags ? (row[mapping.tags] || "").trim() : "",
  };
}

/* ──────────── Document insertion ─────────────── */

/** Insert a document + initial version + audit log. Returns the new document ID. */
async function insertDocumentRow(
  resolved: ResolvedRow,
  userId: number,
  userName: string,
  now: string,
): Promise<{ id: number } | null> {
  const placeholderKey = genKey("txt");
  const placeholderBuf = Buffer.from(
    `مستند مستورد عبر CSV\nالعنوان: ${resolved.title}\nالتاريخ: ${resolved.docDate}\nالوصف: ${resolved.description || ""}`,
  );
  await writeKey(placeholderKey, placeholderBuf);

  const [doc] = await db
    .insert(documents)
    .values({
      title: resolved.title,
      description: resolved.description,
      docNumber: resolved.docNumber,
      docType: resolved.docTypeVal,
      docTypeId: resolved.docTypeIdVal,
      status: resolved.status,
      confidential: resolved.confidential,
      storageKey: placeholderKey,
      thumbKey: null,
      originalName: `${resolved.title}.txt`,
      fileName: placeholderKey.split("/").pop()!,
      mimeType: "text/plain",
      fileExt: "txt",
      fileSize: placeholderBuf.length,
      pageCount: 1,
      contentText: resolved.description,
      ocrProcessed: 0,
      departmentId: resolved.deptId,
      folderId: resolved.folderId,
      uploadedById: userId,
      docDate: resolved.docDate,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: documents.id });

  if (!doc) return null;

  await db.insert(documentVersions).values({
    documentId: doc.id,
    version: 1,
    storageKey: placeholderKey,
    originalName: `${resolved.title}.txt`,
    fileSize: placeholderBuf.length,
    note: "مستند مستورد عبر CSV",
    uploadedById: userId,
    createdAt: now,
  });

  await logAudit({
    userId,
    userName,
    action: "document.csv_import",
    entityType: "document",
    entityId: doc.id,
    details: `استيراد مستند عبر CSV: ${resolved.title}`,
  });

  return doc;
}

/* ─────────────── Tag attachment ──────────────── */

/** Resolve tag names to IDs and attach them to a document. New tags are
 * auto-created only when the caller has tags.manage (admin/manager); staff
 * silently skip unknown names and attach only existing tags. */
async function attachTagsToDoc(
  docId: number,
  tagsRaw: string,
  tagIdCache: Map<string, number>,
  canCreateTags: boolean,
): Promise<void> {
  if (!tagsRaw) return;

  const tagNames = tagsRaw
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const tagIds: number[] = [];
  for (const tn of tagNames) {
    let tid = tagIdCache.get(tn.toLowerCase());
    // Staff cannot create tags — unknown names are skipped and only existing
    // tags are attached. Admin/manager (tags.manage) may auto-create.
    if (!tid && canCreateTags) {
      try {
        const [newTag] = await db
          .insert(tags)
          .values({ name: tn })
          .returning({ id: tags.id });
        if (newTag) {
          tid = newTag.id;
          tagIdCache.set(tn.toLowerCase(), tid);
        }
      } catch {
        // tag may have been created concurrently — skip
      }
    }
    if (tid) tagIds.push(tid);
  }

  if (tagIds.length > 0) {
    await db
      .insert(documentTags)
      .values(tagIds.map((tagId) => ({ documentId: docId, tagId })))
      .onConflictDoNothing();
  }
}

/* ─────────────────── POST ────────────────────── */

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  // RBAC gate — only users with create permission may import documents
  if (!can(user, "documents.create")) {
    return NextResponse.json({ error: "ليس لديك صلاحية لاستيراد المستندات" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "الرجاء إرسال البيانات بصيغة JSON" }, { status: 400 });
  }

  const { rows, mapping }: { rows: ImportRow[]; mapping: ColumnMapping } = body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "لا توجد بيانات للاستيراد" }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: "الحد الأقصى 5000 سجل في المرة الواحدة" }, { status: 400 });
  }

  const lookups = await buildLookupCache();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  // Permission-derived policy flags (computed once per request)
  const canSetStatus = can(user, "documents.update_all");
  // Same exemption as upload's canManageAllDepts: users with documents.update_all
  // may target any department from the CSV; everyone else is pinned to their own.
  const canSetDepartment = can(user, "documents.update_all");
  const canCreateTags = can(user, "tags.manage");
  const results: { row: number; success: boolean; title?: string; error?: string }[] = [];
  let importedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const resolved = resolveRow(
        row,
        mapping,
        lookups,
        user.departmentId ?? null,
        today,
        canSetStatus,
        canSetDepartment,
      );

      if (typeof resolved === "string") {
        results.push({ row: i + 1, success: false, error: resolved });
        continue;
      }

      const doc = await insertDocumentRow(resolved, user.id, user.name, now);
      if (!doc) {
        results.push({ row: i + 1, success: false, title: resolved.title, error: "فشل إنشاء المستند" });
        continue;
      }

      await attachTagsToDoc(doc.id, resolved.tagsRaw, lookups.tagIdCache, canCreateTags);

      importedCount++;
      results.push({ row: i + 1, success: true, title: resolved.title });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
      results.push({
        row: i + 1,
        success: false,
        title: mapping.title ? (row[mapping.title] || "").trim() : "",
        error: msg,
      });
    }
  }

  return NextResponse.json({
    total: rows.length,
    imported: importedCount,
    failed: rows.length - importedCount,
    results,
  });
}
