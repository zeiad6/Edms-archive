import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { departments, folders, docTypes, tags as tagsTable } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentUser, writeKey, genKey } from "@/lib/server";
import { can } from "@/lib/permissions";
import { extFromName, mimeFromExt } from "@/lib/format";
import { insertDocumentWithFirstVersion, removeStoredKeys } from "@/lib/document-create";
import { runUploadOcr } from "@/lib/ocr-jobs";
import { createImageThumbnail } from "@/lib/thumbnails";
import DOMPurify from "dompurify";

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

/**
 * Verify file magic bytes (file signature) against the normalized extension
 * so an attacker cannot disguise an executable or HTML/script payload as an
 * image, PDF, or Office document.
 */
export function validateMagicBytes(bytes: Buffer, ext: string): boolean {
  if (bytes.length === 0) return false;
  switch (ext) {
    case "pdf":
      return bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
    case "png":
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case "jpg":
    case "jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "gif": {
      if (bytes.length < 6) return false;
      const sig = bytes.subarray(0, 6).toString("latin1");
      return sig === "GIF87a" || sig === "GIF89a";
    }
    case "webp":
      return (
        bytes.length >= 12 &&
        bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
        bytes.subarray(8, 12).toString("latin1") === "WEBP"
      );
    case "bmp":
      return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d;
    case "tiff":
    case "tif":
      return (
        bytes.length >= 4 &&
        ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
          (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
      );
    case "docx":
    case "xlsx":
    case "pptx":
      return (
        bytes.length >= 4 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
      );
    case "doc":
    case "xls":
    case "ppt":
      return (
        bytes.length >= 4 &&
        ((bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) ||
          (bytes[0] === 0x50 && bytes[1] === 0x4b))
      );
    case "rtf":
      return bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "{\\rtf";
    case "svg": {
      const head = bytes.subarray(0, 4096).toString("utf8").trimStart();
      return (
        (head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!DOCTYPE svg")) &&
        /<svg[\s>]/i.test(head)
      );
    }
    case "txt":
    case "csv": {
      // Reject PE/ELF/Mach-O executables or binary blobs with null bytes
      const sample = bytes.subarray(0, Math.min(bytes.length, 512));
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0x00) return false;
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * Sanitize an uploaded SVG buffer via DOMPurify + defense-in-depth stripping
 * of scripts, event handlers, foreignObject, and dangerous URIs.
 */
export async function sanitizeSvgBytes(bytes: Buffer): Promise<Buffer> {
  let raw = bytes.toString("utf8");
  try {
    if (typeof DOMPurify.sanitize === "function") {
      raw = DOMPurify.sanitize(raw, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ["script", "foreignObject", "iframe", "object", "embed"],
      });
    }
  } catch {
    /* fallback to regex sanitization below */
  }
  // Defense-in-depth regex sanitization
  raw = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*\/?>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(?:href|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, "");
  return Buffer.from(raw, "utf8");
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

  // File extension validation — normalize to lowercase for new uploads
  const rawExt = extFromName(file.name);
  const ext = rawExt.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم" }, { status: 400 });
  }

  // Auto-title from file name if not provided (multi-file upload case)
  if (!title) {
    title = file.name.replace(/\.[^.]+$/, "").trim();
  }

  // Never trust the client-supplied MIME type — derive it from the normalized
  // lowercase extension so an SVG/HTML payload cannot be stored as a safe image type.
  const mime = EXTRA_MIME[ext] || mimeFromExt(ext) || "application/octet-stream";
  let bytes: Buffer = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `حجم الملف يتجاوز الحد الأقصى ${MAX_FILE_SIZE / 1024 / 1024} ميجابايت` }, { status: 413 });
  }
  const key = genKey(ext || "bin");

  // Department/folder verification: a regular user may only upload into their
  // own department, and the folder (when given) must exist and belong to the
  // target department. Admins (documents.update_all) are exempt from the
  // department-ownership rule, but the folder is still verified.
  //
  // NOTE: this runs BEFORE `writeKey` on purpose. Validating after the write
  // meant every rejected upload (bad department id, foreign folder, missing
  // doc type) still left the bytes plus a thumbnail in storage/documents/,
  // invisible because no row ever referenced them.
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

  // Validate magic bytes (file signature) before touching disk
  if (!validateMagicBytes(bytes, ext)) {
    return NextResponse.json({ error: "محتوى الملف لا يتطابق مع امتداده أو الملف تالف" }, { status: 400 });
  }

  // Sanitize SVG payloads via DOMPurify before persisting to disk
  if (ext === "svg") {
    bytes = await sanitizeSvgBytes(bytes);
    if (!validateMagicBytes(bytes, "svg")) {
      return NextResponse.json({ error: "ملف SVG غير صالح بعد التعقيم" }, { status: 400 });
    }
  }

  // Deduplicate and verify tag IDs before writing files or DB rows
  const rawTagIds = Array.from(
    new Set(
      String(form.get("tags") || "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  );
  let tagIds: number[] = [];
  if (rawTagIds.length > 0) {
    const existingTags = await db
      .select({ id: tagsTable.id })
      .from(tagsTable)
      .where(inArray(tagsTable.id, rawTagIds));
    const validSet = new Set(existingTags.map((t) => t.id));
    tagIds = rawTagIds.filter((id) => validSet.has(id));
  }

  let thumbKey: string | null = null;
  let docId: number;
  try {
    await writeKey(key, bytes);
    thumbKey = await createImageThumbnail(key);

    docId = await insertDocumentWithFirstVersion({
      doc: {
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
      },
      versionNote: "النسخة الأولى المرفوعة",
      tagIds,
      audit: {
        userId: user.id,
        userName: user.name,
        action: "document.upload",
        details: `رفع مستند جديد: ${title} (${file.name})`,
      },
      writtenKeys: [key, thumbKey],
    });
  } catch (err) {
    await removeStoredKeys([key, thumbKey]);
    console.error("[upload] failed to save document", err);
    return NextResponse.json({ error: "فشل حفظ المستند" }, { status: 500 });
  }

  // OCR async — لا ننتظرها حتى لا تؤخر الاستجابة
  runUploadOcr(docId, key, { id: user.id, name: user.name }).catch((e) => console.error("Background OCR failed", e));

  return NextResponse.json({ id: docId });
}
