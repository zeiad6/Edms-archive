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
  "png", "jpg", "jpeg", "webp", "gif", "bmp",
  "pdf", "txt", "csv",
]);

// Streams the stored object directly from disk (no full buffering) — efficient
// for large PDFs, with full HTTP Range (206 Partial Content) support.
// Every request is gated by the RBAC check and logged.
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

  const rangeHeader = request.headers.get("range");
  if (!isThumb && (!rangeHeader || rangeHeader.startsWith("bytes=0-"))) {
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

  // SVG is served with Content-Disposition: attachment + CSP sandbox so direct
  // top-level navigation forces a download and neutralizes scripts, while <img>
  // tags continue to display SVG previews normally (browsers ignore attachment
  // disposition for <img> subresources).
  const fileExt = (doc.fileExt || extFromName(doc.originalName || doc.fileName || "")).toLowerCase();
  const isSvg = fileExt === "svg" || (doc.mimeType || "").toLowerCase().includes("svg");
  const inlineSafe = (isThumb && !isSvg) || (INLINE_PREVIEWABLE.has(fileExt) && !isSvg);
  // HTTP header values must be Latin-1 (ByteString <= 255): keep `filename="..."`
  // strictly ASCII and carry the full UTF-8 Arabic name in `filename*=UTF-8''...`.
  const asciiFallback =
    (filename || "document")
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_")
      .trim() || `document.${fileExt || "bin"}`;
  const disposition =
    isDownload || !inlineSafe || isSvg
      ? `attachment; filename="${asciiFallback}"; filename*=UTF-8''${rfc5987(filename || "document")}`
      : "inline";

  const baseHeaders: Record<string, string> = {
    "Content-Type": doc.mimeType || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Disposition": disposition,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy":
      isSvg || disposition !== "inline"
        ? "default-src 'none'; sandbox"
        : "frame-ancestors 'self'",
  };

  // HTTP Range support (206 Partial Content) for PDF/media streaming
  if (rangeHeader && size > 0) {
    const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (m) {
      let start = m[1] ? Number.parseInt(m[1], 10) : 0;
      let end = m[2] ? Number.parseInt(m[2], 10) : size - 1;
      if (!m[1] && m[2]) {
        // suffix-byte-range-spec: bytes=-500 (last 500 bytes)
        const suffixLen = Number.parseInt(m[2], 10);
        start = Math.max(0, size - suffixLen);
        end = size - 1;
      }
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start < 0 ||
        start >= size ||
        end < start
      ) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes */${size}`,
          },
        });
      }
      end = Math.min(end, size - 1);
      const chunkLength = end - start + 1;
      const partialStream = Readable.toWeb(
        createReadStream(absPath, { start, end }),
      ) as ReadableStream<Uint8Array>;

      return new NextResponse(partialStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(chunkLength),
        },
      });
    }
  }

  const stream = Readable.toWeb(createReadStream(absPath)) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(size),
    },
  });
}
