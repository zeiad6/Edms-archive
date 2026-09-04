import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { departments, documents, documentVersions, documentTags, folders, docTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, logAudit, writeKey, genKey, resolveKey } from "@/lib/server";
import { can } from "@/lib/permissions";
import { extFromName, mimeFromExt } from "@/lib/format";
import { runTesseractOcr } from "@/lib/tesseract";
import { extractDocumentText } from "@/lib/document-text";
import { createImageThumbnail } from "@/lib/thumbnails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf",
  "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "svg", "webp",
]);

// Extension → MIME supplement for allowed types missing from `mimeFromExt`.
// The stored MIME is always derived from the extension — never from the
// client-supplied `file.type`.
const EXTRA_MIME: Record<string, string> = {
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  rtf: "application/rtf",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
};

/**
 * تحقق من أن السلسلة تاريخ حقيقي بصيغة yyyy-mm-dd —
 * يشمل التحقق من صحة الشهر واليوم وعدم تجاوز أيام الشهر (مثل 2024-02-30).
 */
function isValidDateString(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  // RBAC gate — only users with create permission may upload
  if (!can(user, "documents.create")) {
    return NextResponse.json({ error: "ليس لديك صلاحية لرفع المستندات" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  let title = String(form.get("title") || "").trim();
  if (!file) {
    return NextResponse.json({ error: "الرجاء اختيار ملف وإدخال العنوان" }, { status: 400 });
  }

  // File size validation
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `حجم الملف يتجاوز الحد الأقصى ${MAX_FILE_SIZE / 1024 / 1024} ميجابايت` }, { status: 413 });
  }

  // File extension validation — extension is required (no extensionless files)
  const ext = extFromName(file.name);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext.toLowerCase())) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم" }, { status: 400 });
  }

  // Auto-title from file name if not provided (multi-file upload case)
  if (!title) {
    title = file.name.replace(/\.[^.]+$/, "").trim();
  }

  // Never trust the client-supplied MIME type — derive it from the file
  // extension so an SVG/HTML payload cannot be stored as a safe image type.
  const mime = EXTRA_MIME[ext] || mimeFromExt(ext) || "application/octet-stream";
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `حجم الملف يتجاوز الحد الأقصى ${MAX_FILE_SIZE / 1024 / 1024} ميجابايت` }, { status: 413 });
  }
  const key = genKey(ext || "bin");
  await writeKey(key, bytes);
  const thumbKey = await createImageThumbnail(key);

  // Department/folder verification: a regular user may only upload into their
  // own department, and the folder (when given) must exist and belong to the
  // target department. Admins (documents.update_all) are exempt from the
  // department-ownership rule, but the folder is still verified.
  const canManageAllDepts = can(user, "documents.update_all");

  let deptId: number | null = null;
  const deptRaw = form.get("departmentId");
  if (deptRaw !== null && String(deptRaw).trim() !== "") {
    const requestedDept = Number(deptRaw);
    if (!Number.isInteger(requestedDept) || requestedDept <= 0) {
      return NextResponse.json({ error: "قسم غير صالح" }, { status: 400 });
    }
    if (!canManageAllDepts && requestedDept !== user.departmentId) {
      return NextResponse.json({ error: "لا يمكنك الرفع إلى قسم آخر" }, { status: 403 });
    }
    const deptRow = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, requestedDept))
      .limit(1);
    if (!deptRow[0]) {
      return NextResponse.json({ error: "القسم غير موجود" }, { status: 400 });
    }
    deptId = requestedDept;
  } else {
    deptId = user.departmentId ?? null;
  }

  let folderId: number | null = null;
  const folderRaw = form.get("folderId");
  if (folderRaw !== null && String(folderRaw).trim() !== "") {
    const requestedFolder = Number(folderRaw);
    if (!Number.isInteger(requestedFolder) || requestedFolder <= 0) {
      return NextResponse.json({ error: "مجلد غير صالح" }, { status: 400 });
    }
    const folderRow = await db
      .select({ id: folders.id, departmentId: folders.departmentId })
      .from(folders)
      .where(eq(folders.id, requestedFolder))
      .limit(1);
    const folder = folderRow[0];
    if (!folder) {
      return NextResponse.json({ error: "المجلد غير موجود" }, { status: 400 });
    }
    // Folder must belong to the target department (null = legacy/global folder)
    if (folder.departmentId !== null && folder.departmentId !== deptId) {
      return NextResponse.json({ error: "المجلد لا ينتمي إلى القسم المحدد" }, { status: 400 });
    }
    folderId = requestedFolder;
  }

  // Resolve the textual docType to its docTypeId (if the name exists in
  // doc_types); otherwise store null so the FK stays consistent.
  const docTypeRaw = (form.get("docType") as string) || null;
  const docTypeVal = docTypeRaw ? String(docTypeRaw).trim() || null : null;
  let docTypeId: number | null = null;
  if (docTypeVal) {
    const [typeRow] = await db
      .select({ id: docTypes.id })
      .from(docTypes)
      .where(eq(docTypes.name, docTypeVal))
      .limit(1);
    docTypeId = typeRow?.id ?? null;
  }

  // تاريخ المستند: يُستخدم التاريخ المرسل من النموذج (yyyy-mm-dd) إن وُجد
  // وصحيح، وإلا يُضبط تلقائياً على تاريخ اليوم.
  const docDateRaw = String(form.get("docDate") || "").trim();
  let docDate: string;
  if (docDateRaw) {
    if (!isValidDateString(docDateRaw)) {
      return NextResponse.json({ error: "صيغة تاريخ المستند غير صحيحة (يُتوقع YYYY-MM-DD)" }, { status: 400 });
    }
    docDate = docDateRaw;
  } else {
    docDate = new Date().toISOString().slice(0, 10);
  }

  const [doc] = await db
    .insert(documents)
    .values({
      title,
      description: (form.get("description") as string) || null,
      docNumber: (form.get("docNumber") as string) || null,
      docType: docTypeVal,
      docTypeId,
      status: "pending_review",
      confidential: form.get("confidential") === "on" ? 1 : 0,
      storageKey: key,
      thumbKey,
      originalName: file.name,
      fileName: key.split("/").pop()!,
      mimeType: mime,
      fileExt: ext || null,
      fileSize: bytes.length,
      contentText: (form.get("description") as string) || null,
      ocrProcessed: 0,
      departmentId: deptId,
      folderId,
      uploadedById: user.id,
      docDate,
      keywords: (form.get("keywords") as string)?.trim() || null,
      source: (form.get("source") as string)?.trim() || null,
      notes: (form.get("notes") as string)?.trim() || null,
    })
    .returning({ id: documents.id });

  if (doc?.id) {
    await db.insert(documentVersions).values({
      documentId: doc.id,
      version: 1,
      storageKey: key,
      originalName: file.name,
      fileSize: bytes.length,
      note: "النسخة الأولى المرفوعة",
      uploadedById: user.id,
    });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "document.upload",
      entityType: "document",
      entityId: doc.id,
      details: `رفع مستند جديد: ${title} (${file.name})`,
    });

    // Attach tags if provided
    const tagsStr = form.get("tags") as string | null;
    if (tagsStr && tagsStr.trim()) {
      const tagIds = tagsStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0);
      if (tagIds.length > 0) {
        await db.insert(documentTags).values(tagIds.map((tagId) => ({ documentId: doc.id, tagId })));
      }
    }

    // OCR async — لا ننتظرها حتى لا تؤخر الاستجابة
    runOcr(doc.id, key, user).catch((e) => console.error("Background OCR failed", e));
  }

  return NextResponse.json({ id: doc?.id });
}

/** تنفيذ استخراج النص في الخلفية بعد الرفع — PDF نصي مباشر أو OCR محلي */
async function runOcr(docId: number, storageKey: string, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const filePath = resolveKey(storageKey);
  const text = await extractDocumentText(filePath);

  await db
    .update(documents)
    .set({ contentText: text || null, ocrProcessed: text ? 1 : 0 })
    .where(eq(documents.id, docId));

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "document.ocr",
    entityType: "document",
    entityId: docId,
    details: "استخراج النص تلقائياً بعد الرفع",
  });
}
