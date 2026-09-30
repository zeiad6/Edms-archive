"use server";

import { revalidatePath } from "next/cache";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { db } from "@/db";
import { documents, documentVersions, docTypes, departments, folders } from "@/db/schema";
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

/**
 * Collect the on-disk payload keys of documents that are about to be purged.
 *
 * Purging a document row without unlinking its `storageKey`/`thumbKey` and
 * its version files leaves the bytes in storage/ forever: invisible in the
 * UI (the rows are gone) but still on disk, still counted in the backup zip,
 * and still recoverable — a data-retention defect for an archiving product.
 *
 * MUST be called BEFORE the row delete, because the version rows cascade away
 * with the document and their storage keys would be unrecoverable after it.
 * Pass the returned set to {@link unlinkPayloadKeys} once the delete commits.
 */
async function collectDocumentPayloadKeys(
  docs: { id: number; storageKey: string | null; thumbKey: string | null }[]
): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const doc of docs) {
    if (doc.storageKey) keys.add(doc.storageKey);
    if (doc.thumbKey) keys.add(doc.thumbKey);
  }
  if (docs.length > 0) {
    const versions = await db
      .select({ storageKey: documentVersions.storageKey })
      .from(documentVersions)
      .where(inArray(documentVersions.documentId, docs.map((d) => d.id)));
    for (const v of versions) {
      if (v.storageKey) keys.add(v.storageKey);
    }
  }
  return keys;
}

/**
 * Unlink collected payload keys after the owning rows are gone, so only
 * unreferenced files are touched. A missing file is not an error
 * (`force: true`); a failure is logged rather than thrown so the purge itself
 * is never blocked by a locked file.
 */
async function unlinkPayloadKeys(keys: Set<string>): Promise<void> {
  await Promise.all(
    [...keys].map(async (key) => {
      try {
        await unlink(resolveKey(key));
      } catch (e) {
        console.error(`[documents] could not unlink ${key}:`, e);
      }
    })
  );
}

export async function emptyTrash() {
  const user = await getCurrentUser();
  requirePermission(user, "trash.purge");
  const deletedDocs = await db.select().from(documents).where(sql`deleted_at IS NOT NULL`);
  const accessible = deletedDocs.filter((doc) => canAccessDocument(user, doc));
  if (accessible.length === 0) return;
  const ids = accessible.map((d) => d.id);
  const payloadKeys = await collectDocumentPayloadKeys(accessible);
  await db.delete(documents).where(inArray(documents.id, ids));
  await unlinkPayloadKeys(payloadKeys);
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
  const payloadKeys = await collectDocumentPayloadKeys([doc]);
  await db.delete(documents).where(sql`deleted_at IS NOT NULL AND ${eq(documents.id, id)}`);
  await unlinkPayloadKeys(payloadKeys);
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

/**
 * Validate the department/folder a scanned document may be filed into.
 *
 * The upload route (`src/app/api/upload/route.ts`) and the CSV importer
 * (`src/app/api/documents/import-csv/route.ts`) both pin a non-admin to their
 * own department. The scan-save actions did not, so any authenticated user
 * could file a document into an arbitrary department (or into a folder owned
 * by one) by passing `departmentId`/`folderId` straight to the insert — the
 * one write path where the department boundary was missing.
 *
 * @returns The resolved department and folder ids to persist.
 * @throws {Error} When the department or folder is invalid or not permitted.
 */
async function resolveScanTarget(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  requestedDepartmentId?: number,
  requestedFolderId?: number
): Promise<{ departmentId: number | null; folderId: number | null }> {
  const canManageAllDepts = can(user, "documents.update_all");

  let departmentId: number | null = null;
  if (requestedDepartmentId !== undefined && requestedDepartmentId !== null) {
    if (!Number.isInteger(requestedDepartmentId) || requestedDepartmentId <= 0) {
      throw new Error("قسم غير صالح");
    }
    if (!canManageAllDepts && requestedDepartmentId !== user.departmentId) {
      throw new Error("لا يمكنك الحفظ في قسم آخر");
    }
    const deptRow = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, requestedDepartmentId))
      .limit(1);
    if (!deptRow[0]) throw new Error("القسم غير موجود");
    departmentId = requestedDepartmentId;
  } else {
    departmentId = user.departmentId ?? null;
  }

  let folderId: number | null = null;
  if (requestedFolderId !== undefined && requestedFolderId !== null) {
    if (!Number.isInteger(requestedFolderId) || requestedFolderId <= 0) {
      throw new Error("مجلد غير صالح");
    }
    const folderRow = await db
      .select({ id: folders.id, departmentId: folders.departmentId })
      .from(folders)
      .where(eq(folders.id, requestedFolderId))
      .limit(1);
    const folder = folderRow[0];
    if (!folder) throw new Error("المجلد غير موجود");
    // A folder with no department is a legacy/global folder and stays
    // reachable from anywhere; anything else must belong to the target.
    if (folder.departmentId !== null && folder.departmentId !== departmentId) {
      throw new Error("المجلد لا ينتمي إلى القسم المحدد");
    }
    folderId = requestedFolderId;
  }

  return { departmentId, folderId };
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

  if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mime.toLowerCase())) throw new Error("صيغة الصورة غير مدعومة");
  const ext = mime.toLowerCase().includes("png") ? "png" : mime.toLowerCase().includes("webp") ? "webp" : "jpg";
  const safeMime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  // Validate the target department/folder BEFORE persisting the bytes, so a
  // rejected scan never leaves an orphan file in storage/.
  const target = await resolveScanTarget(user, input.departmentId, input.folderId);

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
      mimeType: safeMime,
      fileExt: ext,
      fileSize: buf.length,
      contentText: input.description || null,
      ocrProcessed: 0,
      departmentId: target.departmentId,
      folderId: target.folderId,
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

/**
 * Save a multi-page scan assembled by the hardware multi-scan window as a
 * single PDF document. Mirrors `saveScannedDocument` (auth, 20MB cap, audit,
 * version row) but accepts `data:application/pdf;base64,…` produced locally
 * by `scannedDataUrlsToPdfDataUrl` — the bytes never leave the machine
 * unencrypted beyond the existing session.
 */
export async function saveScannedPdfDocument(input: {
  title: string;
  description?: string;
  docType?: string;
  docNumber?: string;
  departmentId?: number;
  folderId?: number;
  dataUrl: string;
  pageCount: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("يجب تسجيل الدخول لحفظ المستند الممسوح");
  const m = /^data:application\/pdf;base64,(.*)$/.exec(input.dataUrl);
  if (!m) throw new Error("صيغة ملف PDF غير صحيحة");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 5 || buf.toString("latin1", 0, 5) !== "%PDF-") {
    throw new Error("ملف PDF غير صالح");
  }

  const MAX_SCAN_SIZE = 20 * 1024 * 1024; // 20 MB
  if (buf.length > MAX_SCAN_SIZE) {
    throw new Error(`حجم الملف يتجاوز الحد الأقصى ${MAX_SCAN_SIZE / 1024 / 1024} ميجابايت`);
  }

  // Validate the target department/folder BEFORE persisting the bytes, so a
  // rejected scan never leaves an orphan file in storage/.
  const target = await resolveScanTarget(user, input.departmentId, input.folderId);

  const key = genKey("pdf");
  await writeKey(key, buf);

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
      thumbKey: null,
      originalName: `${input.title || "scan"}.pdf`,
      fileName: key.split("/").pop()!,
      mimeType: "application/pdf",
      fileExt: "pdf",
      fileSize: buf.length,
      pageCount: input.pageCount > 0 ? input.pageCount : 1,
      contentText: input.description || null,
      ocrProcessed: 0,
      departmentId: target.departmentId,
      folderId: target.folderId,
      uploadedById: user.id,
      docDate: new Date().toISOString().slice(0, 10),
    })
    .returning({ id: documents.id });

  if (doc?.id) {
    await db.insert(documentVersions).values({
      documentId: doc.id,
      version: 1,
      storageKey: key,
      originalName: `${input.title || "scan"}.pdf`,
      fileSize: buf.length,
      note: `مسح ضوئي متعدد (${input.pageCount} صفحات) عبر نافذة الماسحة`,
      uploadedById: user.id,
    });
    await logAudit({
      userId: user?.id,
      userName: user?.name,
      action: "document.scan",
      entityType: "document",
      entityId: doc.id,
      details: `إيداع مستند ممسوح PDF (${input.pageCount} صفحات): ${input.title}`,
    });
  }
  revalidatePath("/documents");
  return { id: doc?.id };
}
