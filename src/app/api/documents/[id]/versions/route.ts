import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, documents, documentVersions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser, canAccessDocument, writeKey, genKey } from "@/lib/server";
import { can } from "@/lib/permissions";
import { extFromName, mimeFromExt } from "@/lib/format";
import { createImageThumbnail } from "@/lib/thumbnails";
import { removeStoredKeys } from "@/lib/document-create";

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

  // File extension validation — extension is required (no extensionless files)
  const ext = extFromName(file.name);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext.toLowerCase())) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم أو الامتداد مفقود" }, { status: 400 });
  }

  // Derive MIME securely from extension, never trusting client-supplied file.type alone
  const mime = mimeFromExt(ext) || "application/octet-stream";
  const bytes = Buffer.from(await file.arrayBuffer());
  const key = genKey(ext || "bin");
  await writeKey(key, bytes);

  const isImage = mime.startsWith("image/");
  const newThumbKey = isImage ? await createImageThumbnail(key) : null;

  // Version row, audit entry and document pointer commit together, so a failed
  // write can no longer leave a version row whose file was just unlinked.
  // The number comes from the row as it is INSIDE the batch, not from `doc`:
  // that read happened several awaits ago, and concurrent uploads to one
  // document all got the same number from it. The batch runs synchronously on
  // the shared connection, so nothing interleaves. The audit row precedes the
  // update so both reads still see the old `documents.version`.
  const nextVersion = sql<number>`(SELECT version + 1 FROM documents WHERE id = ${docId})`;
  let next: number;
  try {
    const [[inserted]] = await db.batch([
      db
        .insert(documentVersions)
        .values({
          documentId: docId,
          version: nextVersion,
          storageKey: key,
          originalName: file.name,
          fileSize: bytes.length,
          note: note ?? sql`${"الإصدار "} || ${nextVersion}`,
          uploadedById: user.id,
        })
        .returning({ version: documentVersions.version }),
      db.insert(auditLogs).values({
        userId: user.id,
        userName: user.name,
        action: "document.version",
        entityType: "document",
        entityId: docId,
        details: sql`${"إضافة الإصدار "} || ${nextVersion} || ${`: ${file.name}`}`,
      }),
      db
        .update(documents)
        .set({
          storageKey: key,
          originalName: file.name,
          fileName: key.split("/").pop()!,
          mimeType: mime,
          fileExt: ext || null,
          fileSize: bytes.length,
          version: sql`${documents.version} + 1`,
          thumbKey: isImage ? newThumbKey ?? key : doc.thumbKey,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(documents.id, docId)),
    ]);
    next = inserted.version;
  } catch (err) {
    // Remove the orphaned files so a failed DB write doesn't leak storage.
    await removeStoredKeys([key, newThumbKey]);
    console.error("Failed to create document version", err);
    return NextResponse.json({ error: "فشل حفظ الإصدار" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, version: next });
}
