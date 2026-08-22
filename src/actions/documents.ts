"use server";

import { revalidatePath } from "next/cache";
import { existsSync } from "node:fs";
import { db } from "@/db";
import { documents, documentVersions, docTypes } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { getCurrentUser, logAudit, genKey, writeKey, resolveKey, canAccessDocument } from "@/lib/server";
import { can, requirePermission } from "@/lib/permissions";
import { extractDocumentText } from "@/lib/document-text";
import { createImageThumbnail } from "@/lib/thumbnails";

export async function updateDocument(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!id) return;

  // Verify the user has access to the document before updating
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return;
  if (!canAccessDocument(user, doc)) return;

  const deptRaw = formData.get("departmentId");
  const folderRaw = formData.get("folderId");
  const deptNum = deptRaw ? Number(deptRaw) : NaN;
  const folderNum = folderRaw ? Number(folderRaw) : NaN;

  // Staff/manager may only edit the basic fields of documents they can access.
  // Changing status / confidential / departmentId requires `documents.update_all` (admin).
  const privileged = can(user, "documents.update_all");

  // Resolve the textual docType to its docTypeId (if the name exists in
  // doc_types); otherwise store null so the FK stays consistent.
  const docTypeVal = ((formData.get("docType") as string) || "").trim() || null;
  let docTypeId: number | null = null;
  if (docTypeVal) {
    const [typeRow] = await db
      .select({ id: docTypes.id })
      .from(docTypes)
      .where(eq(docTypes.name, docTypeVal))
      .limit(1);
    docTypeId = typeRow?.id ?? null;
  }

  await db
    .update(documents)
    .set({
      title: String(formData.get("title") || "").trim(),
      docNumber: (formData.get("docNumber") as string) || null,
      docType: docTypeVal,
      docTypeId,
      description: (formData.get("description") as string) || null,
      // Privileged fields are only applied for admins; otherwise the stored
      // values are left untouched.
      ...(privileged
        ? {
            status: (formData.get("status") as "active" | "pending_review" | "archived" | "draft") || "active",
            confidential: formData.get("confidential") === "on" ? 1 : 0,
            departmentId: Number.isFinite(deptNum) ? deptNum : null,
          }
        : {}),
      folderId: Number.isFinite(folderNum) ? folderNum : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(documents.id, id));
  await logAudit({
    userId: user?.id,
    userName: user?.name,
    action: "document.update",
    entityType: "document",
    entityId: id,
    details: privileged ? "تحديث بيانات المستند الوصفية" : "تحديث البيانات الأساسية للمستند",
  });
  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
}

export async function runDocumentOcr(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const docId = Number(formData.get("id"));
  if (!docId) return;

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
    if (!doc) return;
    if (!canAccessDocument(user, doc)) return;
    if (!doc.storageKey) return;

    const filePath = resolveKey(doc.storageKey);
    if (!existsSync(filePath)) return;

    // Smart text extraction: PDF text layer first, then local Tesseract OCR.
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
      details: `استخراج النص من المستند: ${doc.title}`,
    });
  } catch (e) {
    console.error("OCR failed", e);
  }

  revalidatePath(`/documents/${docId}`);
}

export async function deleteDocument(id: number) {
  const user = await getCurrentUser();
  requirePermission(user, "documents.delete");
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return;
  if (!canAccessDocument(user, doc)) return;
  await db.update(documents).set({ deletedAt: new Date().toISOString(), deletedById: user.id }).where(eq(documents.id, id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "document.soft_delete",
    entityType: "document",
    entityId: id,
    details: "نقل المستند إلى السلة",
  });
  revalidatePath("/documents");
  revalidatePath("/trash");
}

export async function restoreDocument(id: number) {
  const user = await getCurrentUser();
  requirePermission(user, "documents.restore");
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return;
  if (!canAccessDocument(user, doc)) return;
  await db.update(documents).set({ deletedAt: null, deletedById: null }).where(eq(documents.id, id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "document.restore",
    entityType: "document",
    entityId: id,
    details: "استعادة مستند من السلة",
  });
  revalidatePath("/trash");
  revalidatePath("/documents");
}

export async function emptyTrash() {
  const user = await getCurrentUser();
  requirePermission(user, "trash.purge");
  const deletedDocs = await db.select().from(documents).where(sql`deleted_at IS NOT NULL`);
  const accessible = deletedDocs.filter((doc) => canAccessDocument(user, doc));
  if (accessible.length === 0) return;
  const ids = accessible.map((d) => d.id);
  await db.delete(documents).where(inArray(documents.id, ids));
  await logAudit({
    userId: user?.id,
    userName: user?.name,
    action: "trash.empty",
    entityType: "document",
    entityId: 0,
    details: `تفريغ سلة المحذوفات (${accessible.length} مستند)`,
  });
  revalidatePath("/trash");
}

export async function forceDeleteDocument(id: number) {
  const user = await getCurrentUser();
  requirePermission(user, "documents.force_delete");
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return;
  if (!canAccessDocument(user, doc)) return;
  await db.delete(documents).where(sql`deleted_at IS NOT NULL AND ${eq(documents.id, id)}`);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "document.force_delete",
    entityType: "document",
    entityId: id,
    details: "حذف مستند نهائياً من السلة",
  });
  revalidatePath("/trash");
}

export async function saveScannedDocument(input: {
  title: string;
  description?: string;
  docType?: string;
  docNumber?: string;
  departmentId?: number;
  folderId?: number;
  dataUrl: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("يجب تسجيل الدخول لحفظ المستند الممسوح");
  const m = /^data:([^;]+);base64,(.*)$/.exec(input.dataUrl);
  if (!m) throw new Error("صيغة الصورة غير صحيحة");
  const mime = m[1];
  const buf = Buffer.from(m[2], "base64");

  // Size validation for scanned documents
  const MAX_SCAN_SIZE = 20 * 1024 * 1024; // 20 MB
  if (buf.length > MAX_SCAN_SIZE) {
    throw new Error(`حجم الملف يتجاوز الحد الأقصى ${MAX_SCAN_SIZE / 1024 / 1024} ميجابايت`);
  }

  const ext = mime.includes("svg") ? "svg" : mime.includes("png") ? "png" : "jpg";
  const key = genKey(ext);
  await writeKey(key, buf);
  const thumbKey = await createImageThumbnail(key);

  // Resolve the textual docType to its docTypeId (if the name exists in
  // doc_types); otherwise store null so the FK stays consistent.
  const docTypeVal = (input.docType || "صورة ضوئية").trim();
  let docTypeId: number | null = null;
  const [typeRow] = await db
    .select({ id: docTypes.id })
    .from(docTypes)
    .where(eq(docTypes.name, docTypeVal))
    .limit(1);
  docTypeId = typeRow?.id ?? null;

  const [doc] = await db
    .insert(documents)
    .values({
      title: input.title || "مستند ممسوح ضوئياً",
      description: input.description || null,
      docNumber: input.docNumber || null,
      docType: docTypeVal,
      docTypeId,
      status: "active",
      storageKey: key,
      thumbKey,
      originalName: `${input.title || "scan"}.${ext}`,
      fileName: key.split("/").pop()!,
      mimeType: mime,
      fileExt: ext,
      fileSize: buf.length,
      contentText: input.description || null,
      ocrProcessed: 0,
      departmentId: input.departmentId ?? user?.departmentId ?? null,
      folderId: input.folderId ?? null,
      uploadedById: user.id,
      docDate: new Date().toISOString().slice(0, 10),
    })
    .returning({ id: documents.id });

  if (doc?.id) {
    await db.insert(documentVersions).values({
      documentId: doc.id,
      version: 1,
      storageKey: key,
      originalName: `${input.title || "scan"}.${ext}`,
      fileSize: buf.length,
      note: "مسح ضوئي عبر جسر الماسحة",
      uploadedById: user.id,
    });
    await logAudit({
      userId: user?.id,
      userName: user?.name,
      action: "document.scan",
      entityType: "document",
      entityId: doc.id,
      details: `إيداع مستند ممسوح: ${input.title}`,
    });
  }
  revalidatePath("/documents");
  return { id: doc?.id };
}
