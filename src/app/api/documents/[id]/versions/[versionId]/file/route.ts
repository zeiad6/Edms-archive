import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { db } from "@/db";
import { documents, documentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, canAccessDocument, resolveKey, logAudit } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const docId = Number(id);
  const verId = Number(versionId);

  const user = await getCurrentUser();
  const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  if (!doc) return new NextResponse("Not Found", { status: 404 });
  if (!user || !canAccessDocument(user, doc)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [ver] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, verId))
    .limit(1);
  if (!ver || ver.documentId !== docId) return new NextResponse("Not Found", { status: 404 });

  let absPath: string;
  let size: number;
  try {
    absPath = resolveKey(ver.storageKey);
    size = (await stat(absPath)).size;
  } catch {
    return new NextResponse("File Missing", { status: 404 });
  }

  const filename = ver.originalName || `version-${ver.version}`;
  const safeName = filename.replace(/[^\w\u0600-\u06FF.\- ]/g, "_");
  // RFC 5987: percent-encoded UTF-8 fallback so Arabic filenames survive
  // non-ASCII-unaware clients (filename= stays ASCII-safe for the rest).
  const encodedName = encodeURIComponent(filename).replace(/[!'()*~]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  const disposition = `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`;

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "document.version.download",
    entityType: "document",
    entityId: docId,
    details: `تنزيل الإصدار ${ver.version}: ${filename}`,
  });

  const stream = Readable.toWeb(createReadStream(absPath)) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      // documentVersions has no mime column — document-level mimeType is the
      // stored source of truth for the file's content type.
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
