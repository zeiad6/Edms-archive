import { NextRequest, NextResponse } from "next/server";
import { createReadStream, openSync, closeSync, statSync, readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
// archiver v8 is ESM with named class exports. Static named import (NOT
// createRequire): createRequire compiles to a synchronous __turbopack_require__
// that only resolves modules in the same chunk — in packaged builds it throws
// "p is not a function". Static imports become async chunk loads and work.
import { ZipArchive } from "archiver";
import { db } from "@/db";
import { documents, departments } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getCurrentUser, loadAccessibleDocs, resolveKey, logAudit } from "@/lib/server";
import { STATUS_META, formatDate, formatDateTime } from "@/lib/format";
import type { Document } from "@/db/schema";
import { buildXlsxBuffer, type XlsxDocRow, type XlsxImageExt, type XlsxPreview } from "./xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_DOCS = 50;
// قرار البنية: الكشف في `report/` (اسم عربي) والمستندات في `documents/` (مجلد ASCII
// مستقل) — روابط الكشف نسبية `../documents/<file>` وتُبنى في xlsx.ts.
const REPORT_DIR = "report";
const DOCUMENTS_DIR = "documents";
const MANIFEST_NAME = `${REPORT_DIR}/كشف-المستندات.xlsx`;
const DOCUMENTS_PREFIX = `${DOCUMENTS_DIR}/`;

/**
 * Raster formats Excel can actually render inside a worksheet drawing.
 * The thumbnail engine emits JPEG; originals are used only for raster images.
 */
const RASTER_IMAGE_EXT: Record<string, { ext: XlsxImageExt; contentType: string }> = {
  jpg: { ext: "jpg", contentType: "image/jpeg" },
  jpeg: { ext: "jpg", contentType: "image/jpeg" },
  png: { ext: "png", contentType: "image/png" },
  gif: { ext: "gif", contentType: "image/gif" },
  bmp: { ext: "bmp", contentType: "image/bmp" },
};

/** Skip oversized preview sources so the XLSX (and the ZIP) stays light. */
const MAX_PREVIEW_BYTES = 6 * 1024 * 1024;

/**
 * POST /api/documents/export-selected
 * Body: { ids: number[] }
 * Returns: ZIP stream with `report/كشف-المستندات.xlsx` plus the selected
 * documents' files under `documents/` (real OOXML manifest built by ./xlsx) with:
 *  - a per-row hyperlink (external relationship) pointing at the document
 *    file inside the archive, and
 *  - a preview column embedding each document's thumbnail (or a generated
 *    placeholder icon for non-raster documents).
 * Permission-gated; maximum 50 documents per request.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  let body: { ids?: number[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "json مطلوب body" }, { status: 400 });
  }

  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "اختر مستنداً واحداً على الأقل" }, { status: 400 });
  }
  if (ids.length > MAX_DOCS) {
    return NextResponse.json({ error: `الحد الأقصى ${MAX_DOCS} مستنداً للتصدير` }, { status: 400 });
  }

  // Permission gate — one shared helper so the rule cannot drift between the
  // export, download and bulk-action routes. Missing ids and forbidden ids are
  // both counted as `skipped`, so the response never reveals which ids exist.
  const { accessible, skipped, found } = await loadAccessibleDocs(user, ids, {
    excludeDeleted: true,
  });
  if (accessible.length === 0) {
    // No matching row at all is a 404; a row that exists but is not yours is a
    // 403. Both are decided from the one query the helper already ran.
    if (found === 0) {
      return NextResponse.json({ error: "لا توجد مستندات متطابقة" }, { status: 404 });
    }
    return NextResponse.json({ error: "ليس لديك صلاحية لتصدير هذه المستندات" }, { status: 403 });
  }
  // Resolve department names for the manifest (one query, no N+1)
  const deptIds = [
    ...new Set(
      accessible
        .map((d) => d.departmentId)
        .filter((id): id is number => id !== null && id !== undefined),
    ),
  ];
  const deptMap = new Map<number, string>();
  if (deptIds.length > 0) {
    const depts = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(inArray(departments.id, deptIds));
    for (const d of depts) deptMap.set(d.id, d.name);
  }

  // First pass: pre-flight open each file (skip locked/missing) and fix the
  // safe, unique ZIP entry name — the manifest must only link files that are
  // actually in the archive, so rows are built from this list.
  const entries: { doc: Document; name: string }[] = [];
  const usedNames = new Set<string>();
  for (const doc of accessible) {
    try {
      const absPath = resolveKey(doc.storageKey);
      const fd = openSync(absPath, "r");
      closeSync(fd);
      entries.push({ doc, name: safeZipEntryName(doc, usedNames) });
    } catch (e) {
      // skip missing/locked files silently (bulk-download pattern)
      console.error("[export-selected] file access failed:", e);
    }
  }

  const rows: XlsxDocRow[] = entries.map((entry, i) => ({
    index: i + 1,
    title: entry.doc.title,
    docNumber: entry.doc.docNumber,
    docType: entry.doc.docType,
    status: STATUS_META[entry.doc.status]?.label ?? entry.doc.status,
    departmentName:
      entry.doc.departmentId !== null && entry.doc.departmentId !== undefined
        ? deptMap.get(entry.doc.departmentId) ?? null
        : null,
    date: formatDate(entry.doc.docDate ?? entry.doc.createdAt),
    fileSize: entry.doc.fileSize,
    entryName: entry.name,
    preview: readPreviewImage(entry.doc),
  }));

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "document.export-selected",
    entityType: "document",
    details: `تصدير ${rows.length} مستند مع كشف Excel${skipped > 0 ? ` (تم تخطي ${skipped} لعدم الصلاحية)` : ""}`,
  });

  // Build the XLSX manifest fully in memory (XML parts + ≤50 small preview
  // images) and append it to the ZIP stream.
  const xlsxBuffer = await buildXlsxBuffer(rows, {
    title: `كشف المستندات — ${formatDateTime(new Date())}`,
  });

  // Stream the ZIP instead of buffering it in memory (backup pattern).
  const archive = new ZipArchive({ zlib: { level: 5 } });
  const stream = new PassThrough();

  archive.on("error", () => {
    stream.destroy();
  });
  archive.pipe(stream);

  // Manifest first so it is listed at the top of the archive.
  archive.append(xlsxBuffer, { name: MANIFEST_NAME });

  for (const entry of entries) {
    try {
      const fileStream = createReadStream(resolveKey(entry.doc.storageKey));
      // TOCTOU safety net: consume the error so it can't bubble into
      // archiver's error event and kill the whole ZIP.
      fileStream.on("error", () => {
        /* skip locked/unreadable file */
      });
      archive.append(fileStream, { name: `${DOCUMENTS_PREFIX}${entry.name}` });
    } catch (e) {
      console.error("[export-selected] append failed:", e);
    }
  }

  await archive.finalize();

  return new NextResponse(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="documents-export-${Date.now()}.zip"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Preview images for the Excel sheet
// ───────────────────────────────────────────────────────────────────────────

/**
 * Map a storage key to an embeddable raster kind, or null when the file is
 * not a format Excel can render (PDF, DOCX, SVG thumbnails, …).
 */
function rasterKind(key: string): { ext: XlsxImageExt; contentType: string } | null {
  const m = key.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? (RASTER_IMAGE_EXT[m[1]] ?? null) : null;
}

/**
 * Read a preview image for one document row:
 * - Prefer the generated thumbnail (`thumbKey`) when it is a raster Excel
 *   can embed (the thumbnail engine emits JPEG).
 * - Otherwise, fall back to the original file for raster image documents.
 * - Anything else returns null → the sheet shows a generated placeholder
 *   icon. Never throws; locked/missing/oversized files degrade to null.
 */
function readPreviewImage(doc: Document): XlsxPreview | null {
  try {
    const thumb = doc.thumbKey;
    const thumbKind = thumb ? rasterKind(thumb) : null;
    let key: string | null = null;
    let kind: { ext: XlsxImageExt; contentType: string } | null = null;
    if (thumbKind) {
      key = thumb;
      kind = thumbKind;
    } else {
      kind = rasterKind(doc.storageKey);
      if (kind) key = doc.storageKey;
    }
    if (!key || !kind) return null;

    const abs = resolveKey(key);
    const st = statSync(abs);
    if (!st.isFile() || st.size <= 0 || st.size > MAX_PREVIEW_BYTES) return null;
    return { data: readFileSync(abs), ext: kind.ext, contentType: kind.contentType };
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Safe ZIP entry names
// ───────────────────────────────────────────────────────────────────────────

/**
 * Build a safe, unique ZIP entry name for a document.
 * - Basename only: strips any directory components so a crafted originalName
 *   (`../../etc/passwd`, `C:\...`) can never escape the archive (zip-slip).
 * - Drops control chars and Windows-invalid chars, caps length.
 * - Disambiguates duplicate names with the document id.
 * Same contract as `uniqueZipName` in bulk-download (kept local on purpose so
 * that route stays untouched).
 */
export function safeZipEntryName(
  doc: { id: number; originalName: string; fileName: string },
  usedNames: Set<string>,
): string {
  const raw = doc.originalName || doc.fileName || `document-${doc.id}`;
  const base = raw.split(/[\\/]/).pop()?.trim() ?? "";
  const cleaned = base
    .replace(/\.\.+/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "_")
    .replace(/[:*?"<>|]/g, "_")
    .slice(0, 200);
  let name = cleaned || `document-${doc.id}`;

  if (usedNames.has(name)) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot) : "";
    const stem = dot > 0 ? name.slice(0, dot) : name;
    name = `${stem}-${doc.id}${ext}`;
  }
  usedNames.add(name);
  return name;
}