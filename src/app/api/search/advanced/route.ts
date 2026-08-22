import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, departments, users, tags, documentTags, docTypes } from "@/db/schema";
import { eq, and, desc, sql, inArray, or } from "drizzle-orm";
import { getCurrentUser, canAccessDocument } from "@/lib/server";
import { sanitizeLikeQuery } from "@/lib/format";
import { tokenizeArabicQuery, normalizeArabicTerm } from "@/lib/arabic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    return await handlePost(request);
  } catch (e) {
    console.error("search/advanced failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "خطأ داخلي في البحث" },
      { status: 500 },
    );
  }
}

async function handlePost(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const body = await request.json();
  const {
    query = "",
    operator = "AND",
    docTypes: docTypeFilters = [] as string[],
    departments: deptIds = [] as number[],
    tagIds = [] as number[],
    statuses = [] as string[],
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 50,
  } = body;

  // Clamp pagination: SQLite treats negative LIMIT as "no limit", so a
  // client-supplied pageSize of -1 or 1e9 bypasses pagination (light DoS).
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safePageSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize) || 50)));

  // Build conditions
  const conditions: ReturnType<typeof sql>[] = [sql`${documents.deletedAt} IS NULL`];

  // Text search with boolean operators — Arabic-aware: terms are normalized,
  // stopwords dropped, and light-stemmed so "المستندات" matches "مستند".
  if (query.trim()) {
    const terms = tokenizeArabicQuery(query);

    if (terms.length > 0) {
      if (operator === "AND") {
        // All terms must match (in title, description, contentText, docNumber, or originalName)
        for (const term of terms) {
          const p = sanitizeLikeQuery(term);
          conditions.push(
            sql`(${documents.title} LIKE ${p} ESCAPE '\\' OR ${documents.description} LIKE ${p} ESCAPE '\\' OR ${documents.contentText} LIKE ${p} ESCAPE '\\' OR ${documents.docNumber} LIKE ${p} ESCAPE '\\' OR ${documents.originalName} LIKE ${p} ESCAPE '\\')`
          );
        }
      } else {
        // OR — any term can match
        const orClauses = terms.map(
          (term: string) => {
            const p = sanitizeLikeQuery(term);
            return sql`(${documents.title} LIKE ${p} ESCAPE '\\' OR ${documents.description} LIKE ${p} ESCAPE '\\' OR ${documents.contentText} LIKE ${p} ESCAPE '\\' OR ${documents.docNumber} LIKE ${p} ESCAPE '\\' OR ${documents.originalName} LIKE ${p} ESCAPE '\\')`;
          }
        );
        // NOTE: must use sql.join() — Array.join() would inline "[object Object]"
        // as a single bound parameter and the OR branch would never match anything.
        conditions.push(sql`(${sql.join(orClauses, sql.raw(" OR "))})`);
      }
    }
  }

  // NOT terms: terms prefixed with -
  if (query.trim()) {
    const notTerms = query
      .split(/\s+/)
      .filter((t: string) => t.startsWith("-"))
      .map((t: string) => normalizeArabicTerm(t.slice(1)))
      .filter(Boolean);

    for (const term of notTerms) {
      const p = sanitizeLikeQuery(term);
      conditions.push(
        sql`(${documents.title} NOT LIKE ${p} ESCAPE '\\' AND ${documents.description} NOT LIKE ${p} ESCAPE '\\' AND ${documents.contentText} NOT LIKE ${p} ESCAPE '\\' AND ${documents.docNumber} NOT LIKE ${p} ESCAPE '\\' AND ${documents.originalName} NOT LIKE ${p} ESCAPE '\\')`
      );
    }
  }

  // Doc type filter
  if (docTypeFilters.length > 0) {
    conditions.push(inArray(documents.docType, docTypeFilters));
  }

  // Department filter
  if (deptIds.length > 0) {
    conditions.push(inArray(documents.departmentId, deptIds));
  }

  // Status filter
  if (statuses.length > 0) {
    conditions.push(inArray(documents.status, statuses));
  }

  // Date range
  if (dateFrom) {
    conditions.push(sql`${documents.docDate} >= ${dateFrom}`);
  }
  if (dateTo) {
    conditions.push(sql`${documents.docDate} <= ${dateTo}`);
  }

  // Tag filter — parameterized subquery
  if (tagIds.length > 0) {
    conditions.push(
      sql`${documents.id} IN (SELECT document_id FROM ${documentTags} WHERE ${inArray(documentTags.tagId, tagIds)})`
    );
  }

  // Access control — enforced at SQL level so `total` doesn't leak counts of
  // hidden documents and LIMIT/OFFSET pages don't under-fill after the
  // in-memory canAccessDocument filter below (same rules as lib/server.ts).
  if (user.role !== "admin") {
    conditions.push(
      or(
        eq(documents.departmentId, user.departmentId ?? -1),
        eq(documents.uploadedById, user.id)
      )! // always SQL — both eq() args are non-null here
    );
    if (user.role === "staff") {
      conditions.push(eq(documents.confidential, 0));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const [countResult] = await db
    .select({ total: sql<number>`count(DISTINCT ${documents.id})` })
    .from(documents)
    .where(whereClause);
  const total = Number(countResult?.total ?? 0);

  // Fetch results
  const query_ = db
    .select({
      id: documents.id,
      title: documents.title,
      docNumber: documents.docNumber,
      docType: documents.docType,
      status: documents.status,
      fileSize: documents.fileSize,
      fileExt: documents.fileExt,
      mimeType: documents.mimeType,
      docDate: documents.docDate,
      createdAt: documents.createdAt,
      version: documents.version,
      confidential: documents.confidential,
      departmentId: documents.departmentId,
      description: documents.description,
      storageKey: documents.storageKey,
      thumbKey: documents.thumbKey,
      originalName: documents.originalName,
      fileName: documents.fileName,
      contentText: documents.contentText,
      ocrProcessed: documents.ocrProcessed,
      folderId: documents.folderId,
      uploadedById: documents.uploadedById,
      pageCount: documents.pageCount,
      updatedAt: documents.updatedAt,
      deptName: departments.name,
      deptColor: departments.color,
      docTypeColor: docTypes.color,
      uploaderName: users.name,
      uploaderColor: users.avatarColor,
      tags: sql<string | null>`(
        SELECT group_concat(${tags.name}, ', ')
        FROM ${documentTags}
        LEFT JOIN ${tags} ON ${documentTags.tagId} = ${tags.id}
        WHERE ${documentTags.documentId} = ${documents.id}
      )`,
    })
    .from(documents)
    .leftJoin(departments, eq(documents.departmentId, departments.id))
    .leftJoin(docTypes, eq(documents.docType, docTypes.name))
    .leftJoin(users, eq(documents.uploadedById, users.id))
    .where(whereClause)
    .orderBy(desc(documents.createdAt))
    .limit(safePageSize)
    .offset((safePage - 1) * safePageSize);

  const rows = await query_;

  // Filter by access
  const accessible = rows.filter((r) => canAccessDocument(user, r as any)).map((r) => ({
    id: r.id,
    title: r.title,
    docNumber: r.docNumber,
    docType: r.docType,
    docTypeColor: r.docTypeColor,
    status: r.status,
    fileSize: r.fileSize,
    fileExt: r.fileExt,
    mimeType: r.mimeType,
    docDate: r.docDate,
    createdAt: r.createdAt,
    version: r.version,
    confidential: r.confidential,
    deptName: r.deptName,
    deptColor: r.deptColor,
    uploaderName: r.uploaderName,
    uploaderColor: r.uploaderColor,
    tags: r.tags,
  }));

  return NextResponse.json({
    results: accessible,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
  });
}
