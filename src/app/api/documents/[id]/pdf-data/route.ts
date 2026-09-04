import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, canAccessDocument, resolveKey, logAudit } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Download managers (IDM and similar) intercept `application/pdf` responses
// at the browser network layer and replace the body with an empty 204 —
// which breaks every in-browser PDF viewer on machines that have them (very
// common). Serving the bytes base64-encoded inside `application/json` is
// never touched by download managers, so pdf.js always receives intact data.
const MAX_INLINE_PDF = 32 * 1024 * 1024; // 32 MB — larger files use download

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const docId = Number(id);

  const user = await getCurrentUser();
  const rows = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  if (doc.deletedAt) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  if (!user || !canAccessDocument(user, doc)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (doc.mimeType !== "application/pdf") {
    return NextResponse.json({ error: "المعاينة المضمنة متاحة لملفات PDF فقط" }, { status: 415 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(resolveKey(doc.storageKey));
  } catch {
    return NextResponse.json({ error: "File Missing" }, { status: 404 });
  }
  if (buf.length > MAX_INLINE_PDF) {
    return NextResponse.json(
      { error: "الملف كبير — نزّله لعرضه", tooLarge: true },
      { status: 413 },
    );
  }

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "document.view",
    entityType: "document",
    entityId: doc.id,
    details: `عرض: ${doc.title}`,
  });

  return NextResponse.json({
    data: buf.toString("base64"),
    size: buf.length,
  });
}
