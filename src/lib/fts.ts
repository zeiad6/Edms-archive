import { client, db, dbReady } from "@/db";
import { departments, documents, type Document, type User } from "@/db/schema";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { normalizeArabic, normalizeArabicTerm } from "@/lib/arabic";
import { sanitizeLikeQuery } from "@/lib/format";
import { canAccessDocument } from "@/lib/server";

export interface SpotlightSearchResult {
  id: number;
  title: string;
  docNumber: string;
  docType: string;
  status: string;
  departmentName: string;
  departmentColor: string;
  snippet?: string;
}

/**
 * Build a safe FTS5 MATCH expression from user input.
 * Strips FTS5 syntax characters and turns each token into a quoted prefix query
 * (`"token"*`) so partial words match immediately while typing.
 */
export function buildFts5MatchQuery(raw: string): string | null {
  const cleaned = raw
    .replace(/["'()*^:+-]/g, " ")
    .trim();
  if (!cleaned) return null;
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 8);
  if (tokens.length === 0) return null;
  return tokens.map((tok) => `"${tok}"*`).join(" AND ");
}

/**
 * Synchronize the session-scoped SQLite FTS5 virtual table (`temp.documents_fts`)
 * from `main.documents`. Using the `temp` schema keeps FTS5 `WITHOUT ROWID`
 * shadow tables out of `main.sqlite_master` while giving full SQLite FTS5
 * `MATCH` + `bm25()` ranking over `title`, `content_text`, and `reference_number`.
 */
export async function syncDocumentsFts5(): Promise<boolean> {
  try {
    await dbReady;
    await client.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS temp.documents_fts USING fts5(
        title,
        content_text,
        reference_number,
        ocr_text,
        tokenize='unicode61 remove_diacritics 2'
      )
    `);
    await client.execute(`DELETE FROM temp.documents_fts`);
    await client.execute(`
      INSERT INTO temp.documents_fts(rowid, title, content_text, reference_number, ocr_text)
      SELECT
        id,
        COALESCE(title, ''),
        COALESCE(content_text, ''),
        COALESCE(doc_number, ''),
        COALESCE(ocr_text, '')
      FROM main.documents
      WHERE deleted_at IS NULL
    `);
    return true;
  } catch (err) {
    console.warn("[fts5] fallback to LIKE search:", err);
    return false;
  }
}

/**
 * Search documents using SQLite FTS5 (`MATCH` on `title`, `content_text`,
 * `reference_number`) combined with Arabic-normalized fallback matching and
 * full RBAC filtering.
 */
export async function searchSpotlightDocuments(
  user: User | null,
  rawQuery: string,
  limit: number = 12,
): Promise<SpotlightSearchResult[]> {
  if (!user) return [];
  const safeLimit = Math.max(1, Math.min(50, limit));
  const q = rawQuery.trim();

  // Base RBAC SQL filter
  const rbacConds = [isNull(documents.deletedAt)];
  if (user.role !== "admin") {
    rbacConds.push(
      or(
        eq(documents.departmentId, user.departmentId ?? -1),
        eq(documents.uploadedById, user.id),
      )!,
    );
    if (user.role === "staff") {
      rbacConds.push(eq(documents.confidential, 0));
    }
  }

  // Empty query -> return recent accessible documents for initial Spotlight view
  if (!q) {
    const recentRows = await db
      .select({
        d: documents,
        deptName: departments.name,
        deptColor: departments.color,
      })
      .from(documents)
      .leftJoin(departments, eq(documents.departmentId, departments.id))
      .where(and(...rbacConds))
      .orderBy(desc(documents.createdAt))
      .limit(safeLimit);

    return recentRows
      .filter((r) => canAccessDocument(user, r.d))
      .map((r) => ({
        id: r.d.id,
        title: r.d.title,
        docNumber: r.d.docNumber ?? "",
        docType: r.d.docType ?? "",
        status: r.d.status,
        departmentName: r.deptName ?? "",
        departmentColor: r.deptColor ?? "#94a3b8",
      }));
  }

  // 1. Primary search via SQLite FTS5 MATCH
  const matchedIds: number[] = [];
  const ftsReady = await syncDocumentsFts5();
  const ftsQuery = buildFts5MatchQuery(q);
  if (ftsReady && ftsQuery) {
    try {
      const ftsRes = await client.execute({
        sql: `
          SELECT rowid AS id
          FROM temp.documents_fts
          WHERE temp.documents_fts MATCH ?
          ORDER BY bm25(temp.documents_fts, 10.0, 2.0, 8.0, 2.0)
          LIMIT ?
        `,
        args: [ftsQuery, safeLimit * 2],
      });
      for (const row of ftsRes.rows) {
        const id = Number(row.id);
        if (Number.isInteger(id) && id > 0) matchedIds.push(id);
      }
    } catch {
      /* fallback below */
    }
  }

  // 2. Supplement with Arabic-normalized / LIKE search so normalized variants
  // ("إلى" / "الى", "مؤسسة" / "موسسه") and mid-token numbers also match
  const normTerm = normalizeArabicTerm(q) || q;
  const rawLike = sanitizeLikeQuery(q);
  const normLike = sanitizeLikeQuery(normTerm);

  const likeCond = or(
    sql`${documents.title} LIKE ${rawLike} ESCAPE '\\'`,
    sql`${documents.contentText} LIKE ${rawLike} ESCAPE '\\'`,
    sql`${documents.ocrText} LIKE ${rawLike} ESCAPE '\\'`,
    sql`${documents.docNumber} LIKE ${rawLike} ESCAPE '\\'`,
    sql`${documents.title} LIKE ${normLike} ESCAPE '\\'`,
    sql`${documents.contentText} LIKE ${normLike} ESCAPE '\\'`,
    ...(matchedIds.length > 0 ? [inArray(documents.id, matchedIds)] : []),
  )!;

  const candidateRows = await db
    .select({
      d: documents,
      deptName: departments.name,
      deptColor: departments.color,
    })
    .from(documents)
    .leftJoin(departments, eq(documents.departmentId, departments.id))
    .where(and(...rbacConds, likeCond))
    .orderBy(desc(documents.createdAt))
    .limit(safeLimit * 3);

  // Also check in-memory normalized Arabic match if candidateRows came up short
  let pool = candidateRows;
  if (pool.length < safeLimit) {
    const fallbackRows = await db
      .select({
        d: documents,
        deptName: departments.name,
        deptColor: departments.color,
      })
      .from(documents)
      .leftJoin(departments, eq(documents.departmentId, departments.id))
      .where(and(...rbacConds))
      .orderBy(desc(documents.createdAt))
      .limit(150);

    const seen = new Set(pool.map((r) => r.d.id));
    const normQ = normalizeArabic(q);
    for (const r of fallbackRows) {
      if (seen.has(r.d.id)) continue;
      const hay = normalizeArabic(
        `${r.d.title} ${r.d.docNumber ?? ""} ${r.d.contentText ?? ""} ${r.d.ocrText ?? ""} ${r.deptName ?? ""}`,
      );
      if (hay.includes(normQ)) {
        pool.push(r);
        seen.add(r.d.id);
      }
    }
  }

  // Order FTS5 matches first by their BM25 rank, then remaining matches
  const ftsRank = new Map(matchedIds.map((id, idx) => [id, idx]));
  pool.sort((a, b) => {
    const ra = ftsRank.get(a.d.id) ?? 9999;
    const rb = ftsRank.get(b.d.id) ?? 9999;
    if (ra !== rb) return ra - rb;
    return String(b.d.createdAt).localeCompare(String(a.d.createdAt));
  });

  const out: SpotlightSearchResult[] = [];
  for (const r of pool) {
    if (!canAccessDocument(user, r.d as Document)) continue;
    const bodyText = (r.d.ocrText || r.d.contentText || r.d.description || "").trim();
    out.push({
      id: r.d.id,
      title: r.d.title,
      docNumber: r.d.docNumber ?? "",
      docType: r.d.docType ?? "",
      status: r.d.status,
      departmentName: r.deptName ?? "",
      departmentColor: r.deptColor ?? "#94a3b8",
      snippet: bodyText ? bodyText.slice(0, 120) : undefined,
    });
    if (out.length >= safeLimit) break;
  }

  return out;
}
