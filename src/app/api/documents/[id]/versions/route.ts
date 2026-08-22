import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, canAccessDocument, logAudit, writeKey, genKey, resolveKey } from "@/lib/server";
import { can } from "@/lib/permissions";
import { extFromName, mimeFromExt } from "@/lib/format";
import { createImageThumbnail } from "@/lib/thumbnails";
import { unlink } from "node:fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf",
  "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "svg", "webp",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const docId = Number(id);
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const rows = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (doc.deletedAt) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (!canAccessDocument(user, doc)) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  const canWrite = can(user, "documents.update_all") || doc.uploadedById === user.id;
  if (!canWrite) return NextResponse.json({ error: "لا تملك صلاحية التعديل" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const note = (form.get("note") as string) || null;
  if (!file) return NextResponse.json({ error: "لا يوجد ملف" }, { status: 400 });

  // File size validation
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `حجم الملف يتجاوز الحد الأقصى ${MAX_FILE_SIZE / 1024 / 1024} ميجابايت` }, { status: 413 });
  }

  // File extension validation — same whitelist as the upload route
  const ext = extFromName(file.name);
  if (ext && !ALLOWED_EXTENSIONS.has(ext.toLowerCase())) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم" }, { status: 400 });
  }

  const mime = file.type || mimeFromExt(ext);
  const bytes = Buffer.from(await file.arrayBuffer());
  const key = genKey(ext || "bin");
  await writeKey(key, bytes);

  const next = doc.version + 1;

  try {
    await db.insert(documentVersions).values({
      documentId: docId,
      version: next,
      storageKey: key,
      originalName: file.name,
      fileSize: bytes.length,
      note: note || `الإصدار ${next}`,
      uploadedById: user.id,
    });

    await db
      .update(documents)
      .set({
        storageKey: key,
        originalName: file.name,
        fileName: key.split("/").pop()!,
        mimeType: mime,
        fileExt: ext || null,
        fileSize: bytes.length,
        version: next,
        thumbKey: mime.startsWith("image/") ? (await createImageThumbnail(key)) ?? key : doc.thumbKey,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(documents.id, docId));

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "document.version",
      entityType: "document",
      entityId: docId,
      details: `إضافة الإصدار ${next}: ${file.name}`,
    });
  } catch (err) {
    // Remove the orphaned file so a failed DB write doesn't leak storage.
    await unlink(resolveKey(key)).catch(() => {});
    console.error("Failed to create document version", err);
    return NextResponse.json({ error: "فشل حفظ الإصدار" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, version: next });
}
