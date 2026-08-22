import { NextRequest, NextResponse } from "next/server";
import { createReadStream, openSync, closeSync } from "node:fs";
// archiver v8 is ESM with named class exports. Static named import (NOT
// createRequire): createRequire compiles to a synchronous __turbopack_require__
// that only resolves modules in the same chunk — in packaged builds it throws
// "p is not a function". Static imports become async chunk loads and work.
import { ZipArchive } from "archiver";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getCurrentUser, canAccessDocument, resolveKey, logAudit } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/documents/bulk-download
 * Body: { ids: number[] }
 * Returns: ZIP stream with all selected documents (permission-gated).
 * Maximum 50 documents per request.
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
  if (ids.length > 50) {
    return NextResponse.json({ error: "الحد الأقصى 50 مستنداً للتحميل المجمع" }, { status: 400 });
  }

  // Fetch all requested documents
  const allDocs = await db
    .select()
    .from(documents)
    .where(inArray(documents.id, ids));

  if (allDocs.length === 0) {
    return NextResponse.json({ error: "لا توجد مستندات متطابقة" }, { status: 404 });
  }

  // Permission gate — skip docs the user cannot access or that are soft-deleted
  const accessible = allDocs.filter((doc) => canAccessDocument(user, doc) && !doc.deletedAt);
  if (accessible.length === 0) {
    return NextResponse.json({ error: "ليس لديك صلاحية لتنزيل هذه المستندات" }, { status: 403 });
  }

  // Log audit for bulk download
  const skipped = allDocs.length - accessible.length;
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "document.bulk-download",
    entityType: "document",
    details: `تحميل مجمع: ${accessible.length} مستند${accessible.length === 1 ? "" : "ات"}${skipped > 0 ? ` (تم تخطي ${skipped} لعدم الصلاحية)` : ""}`,
  });

  // Stream the ZIP instead of buffering it in memory — large archives would
  // otherwise exhaust the server heap. Same pattern as api/backup/route.ts.
  const archive = new ZipArchive({ zlib: { level: 5 } });
  const stream = new (await import("node:stream")).PassThrough();

  archive.on("error", () => {
    stream.destroy();
  });
  archive.pipe(stream);

  const usedNames = new Set<string>();
  for (const doc of accessible) {
    try {
      const absPath = resolveKey(doc.storageKey);
      // Pre-flight open: skip locked/missing files instead of letting the
      // async read error destroy the whole archive (backup pattern).
      const fd = openSync(absPath, "r");
      closeSync(fd);
      const fileStream = createReadStream(absPath);
      // TOCTOU safety net: consume the error so it can't bubble into
      // archiver's error event and kill the whole ZIP.
      fileStream.on("error", () => {
        /* skip locked/unreadable file */
      });
      archive.append(fileStream, { name: uniqueZipName(doc, usedNames) });
    } catch (e) {
      // skip missing/locked files silently
      console.error("[bulk-download] file access failed:", e);
    }
  }

  await archive.finalize();

  return new NextResponse(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="documents-bulk-${Date.now()}.zip"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

/**
 * Build a safe, unique ZIP entry name for a document.
 * - Basename only: strips any directory components so a crafted originalName
 *   (`../../etc/passwd`, `C:\...`) can never escape the archive (zip-slip).
 * - Drops control chars and Windows-invalid chars, caps length.
 * - Disambiguates duplicate names with the document id.
 */
function uniqueZipName(
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
