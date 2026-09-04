import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, canAccessDocument, resolveKey, logAudit } from "@/lib/server";
import { extFromName } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rfc5987(name: string): string {
  return encodeURIComponent(name)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A")
    .replace(/%(?:7C|60|5E)/g, unescape);
}

/**
 * Extensions safe to render inline in the browser preview.
 *
 * - Raster images + BMP: natively rendered by <img>, no script risk.
 * - SVG: scripts never run inside <img>; top-level opens are neutralized by
 *   the `default-src 'none'; sandbox` CSP sent with SVG responses below.
 * - PDF: rendered by the browser's built-in viewer (sandboxed by the browser).
 * - TXT/CSV: rendered as plain text (no script execution for text/plain).
 * - Everything else (Office, TIFF, RTF, ...) is forced to download so a
 *   stored file can never execute script inside the application origin.
 *   Thumbnails are server-generated JPEGs and always safe.
 */
const INLINE_PREVIEWABLE = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "bmp", "svg",
  "pdf", "txt", "csv",
]);

// Streams the stored object directly from disk (no full buffering) — efficient
// for large PDFs. Every request is gated by the RBAC check and logged.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const docId = Number(id);
  const sp = request.nextUrl.searchParams;
  const isThumb = sp.get("t") === "1";
  const isDownload = sp.get("download") === "1";

  const user = await getCurrentUser();
  const rows = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  const doc = rows[0];
  if (!doc) return new NextResponse("Not Found", { status: 404 });
  if (doc.deletedAt) return new NextResponse("Not Found", { status: 404 });

  if (!user || !canAccessDocument(user, doc)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let absPath: string;
  let size: number;
  try {
    // Thumbnails serve the small generated JPEG when available (thumbKey),
    // falling back to the original file for documents without one.
    absPath = resolveKey(isThumb && doc.thumbKey ? doc.thumbKey : doc.storageKey);
    size = (await stat(absPath)).size;
  } catch {
    return new NextResponse("File Missing", { status: 404 });
  }

  if (!isThumb) {
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: isDownload ? "document.download" : "document.view",
      entityType: "document",
      entityId: doc.id,
      details: `${isDownload ? "تنزيل" : "عرض"}: ${doc.title}`,
    });
  }

  const filename = doc.originalName || doc.fileName;

  // Inline preview for safe types (images incl. SVG, PDF, plain text) so the
  // <img>/<iframe> preview and the pdf.js viewer render instead of forcing a
  // download. Office/TIFF/RTF/... stay as attachment (no native renderer and
  // must never execute inside the application origin).
  const fileExt = (doc.fileExt || extFromName(doc.originalName || doc.fileName || "")).toLowerCase();
  const inlineSafe = isThumb || INLINE_PREVIEWABLE.has(fileExt);
  const disposition = isDownload || !inlineSafe
    ? `attachment; filename="${(filename || "document").replace(/[^\w\u0600-\u06FF.\- ]/g, "_")}"; filename*=UTF-8''${rfc5987(filename || "document")}`
    : "inline";

  const stream = Readable.toWeb(createReadStream(absPath)) as ReadableStream<Uint8Array>;

  // Per-type framing/CSP policy:
  // - PDF: the built-in viewer needs same-origin framing and no sandbox CSP
  //   (X-Frame-Options: DENY + `sandbox` produced a blank iframe).
  // - SVG: keep a script-neutralizing CSP; <img> rendering is unaffected
  //   (scripts never run in image context) while direct opens stay safe.
  // - Others inline (raster/BMP/text): neutral frame-ancestors, no sandbox.
  const headers: Record<string, string> = {
    "Content-Type": doc.mimeType || "application/octet-stream",
    "Content-Length": String(size),
    "Accept-Ranges": "bytes",
    "Content-Disposition": disposition,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
  };
  if (disposition === "inline") {
    headers["Content-Security-Policy"] =
      fileExt === "svg"
        ? "default-src 'none'; sandbox"
        : "frame-ancestors 'self'";
  } else {
    headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
  }

  return new NextResponse(stream, {
    status: 200,
    headers,
  });
}
