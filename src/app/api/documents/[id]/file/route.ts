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
 * Extensions whose content is safe to render inline. Everything else is forced
 * to download so an uploaded SVG/HTML payload can never execute script in the
 * application origin. Thumbnails are server-generated JPEGs and always safe.
 */
const SAFE_INLINE_RASTER = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

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

  // Only server-generated thumbnails and safe raster images may render inline;
  // every other type (SVG, HTML, PDF, Office, ...) is forced to download so a
  // stored file can never execute script inside the application origin.
  const fileExt = (doc.fileExt || extFromName(doc.originalName || doc.fileName || "")).toLowerCase();
  const inlineSafe = isThumb || SAFE_INLINE_RASTER.has(fileExt);
  const disposition = isDownload || !inlineSafe
    ? `attachment; filename="${(filename || "document").replace(/[^\w\u0600-\u06FF.\- ]/g, "_")}"; filename*=UTF-8''${rfc5987(filename || "document")}`
    : "inline";

  const stream = Readable.toWeb(createReadStream(absPath)) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
