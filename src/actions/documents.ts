"use server";

import { revalidatePath } from "next/cache";
import { access, unlink } from "node:fs/promises";
import { db } from "@/db";
import { documents, documentVersions, docTypes, departments, folders } from "@/db/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getCurrentUser, logAudit, genKey, writeKey, resolveKey, canAccessDocument } from "@/lib/server";
import { can, checkPermission, requirePermission } from "@/lib/permissions";
import { extractDocumentText } from "@/lib/document-text";
import { createImageThumbnail } from "@/lib/thumbnails";
import { insertDocumentWithFirstVersion, removeStoredKeys } from "@/lib/document-create";
import { mergeContentAndOcrText } from "@/lib/ocr-jobs";

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function updateDocument(formData: FormData): Promise<any> {
  const rawUser = await getCurrentUser();
  const perm = checkPermission(rawUser, "documents.update");
  if (!perm.ok) return perm;
  const user = perm.user;

  const id = Number(formData.get("id"));
  if (!id) return;

  // Verify the user has access to the document before updating
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return;
  if (!canAccessDocument(user, doc)) {
    return { ok: false as const, error: "ليس لديك صلاحية لتعديل هذا المستند", code: 403 as const };
  }

  const deptRaw = formData.get("departmentId");
  const folderRaw = formData.get("folderId");
  const deptStr = deptRaw !== null ? String(deptRaw).trim() : "";
  const folderStr = folderRaw !== null ? String(folderRaw).trim() : "";

  // Staff/manager may only edit the basic fields of documents they can access.
  // Changing status / confidential / departmentId requires `documents.update_all` (admin).
  const privileged = can(user, "documents.update_all");

  let targetDepartmentId: number | null = doc.departmentId ?? null;
  if (privileged) {
    if (deptStr !== "") {
      const deptNum = Number(deptStr);
      if (!Number.isInteger(deptNum) || deptNum <= 0) {
        return { ok: false as const, error: "قسم غير صالح", code: 400 as const };
      }
      const [deptRow] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, deptNum))
        .limit(1);
      if (!deptRow) {
        return { ok: false as const, error: "القسم غير موجود", code: 400 as const };
      }
      targetDepartmentId = deptNum;
    } else if (deptRaw !== null) {
      targetDepartmentId = null;
    }
  }

  let targetFolderId: number | null = null;
  if (folderStr !== "") {
    const folderNum = Number(folderStr);
    if (!Number.isInteger(folderNum) || folderNum <= 0) {
      return { ok: false as const, error: "مجلد غير صالح", code: 400 as const };
    }
    const [folderRow] = await db
      .select({ id: folders.id, departmentId: folders.departmentId })
      .from(folders)
      .where(eq(folders.id, folderNum))
      .limit(1);
    if (!folderRow) {
      return { ok: false as const, error: "المجلد غير موجود", code: 400 as const };
    }
    if (folderRow.departmentId !== null && folderRow.departmentId !== targetDepartmentId) {
      return { ok: false as const, error: "المجلد لا ينتمي إلى القسم المحدد", code: 400 as const };
    }
    targetFolderId = folderNum;
  }

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
            departmentId: targetDepartmentId,
          }
        : {}),
      folderId: targetFolderId,
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

export async function runDocumentOcr(formData: FormData): Promise<any> {
  const rawUser = await getCurrentUser();
  const perm = checkPermission(rawUser, "documents.ocr");
  if (!perm.ok) return perm;
  const user = perm.user;

  const docId = Number(formData.get("id"));
  if (!docId) return;

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
    if (!doc) return;
    if (!canAccessDocument(user, doc)) return;
    if (!doc.storageKey) return;

    const filePath = resolveKey(doc.storageKey);
    if (!(await fileExists(filePath))) return;

    // Smart text extraction: PDF text layer first, then local Tesseract OCR.
    const text = await extractDocumentText(filePath);
    const cleanText = (text || "").trim();
    const mergedContent = mergeContentAndOcrText(doc.description, doc.contentText, cleanText);
    const ocrStatus = cleanText.length > 0 ? 1 : 2;

    await db
      .update(documents)
      .set({
        ocrText: cleanText || null,
        contentText: mergedContent,
        ocrProcessed: ocrStatus,
      })
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
    await db
      .update(documents)
      .set({ ocrProcessed: -1 })
      .where(eq(documents.id, docId))
      .catch(() => {});
  }

  revalidatePath(`/documents/${docId}`);
}

export async function deleteDocument(id: number): Promise<any> {
  const rawUser = await getCurrentUser();
  const perm = checkPermission(rawUser, "documents.delete");
  if (!perm.ok) return perm;
  const user = perm.user;
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

export async function restoreDocument(id: number): Promise<any> {
  const rawUser = await getCurrentUser();
  const perm = checkPermission(rawUser, "documents.restore");
  if (!perm.ok) return perm;
  const user = perm.user;
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
        if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") {
          console.error(`[documents] could not unlink ${key}:`, e);
        }
      }
    })
  );
}

const DELETE_CHUNK_SIZE = 200;

export async function emptyTrash(): Promise<any> {
  const rawUser = await getCurrentUser();
  const perm = checkPermission(rawUser, "trash.purge");
  if (!perm.ok) return perm;
  const user = perm.user;

  const deletedDocs = await db.select().from(documents).where(isNotNull(documents.deletedAt));
  const accessible = deletedDocs.filter((doc) => canAccessDocument(user, doc) && doc.deletedAt !== null);
  if (accessible.length === 0) return;

  let totalPurged = 0;
  for (let i = 0; i < accessible.length; i += DELETE_CHUNK_SIZE) {
    const chunk = accessible.slice(i, i + DELETE_CHUNK_SIZE);
    const chunkIds = chunk.map((d) => d.id);

    // Pre-collect payload keys per document before cascade delete
    const keysByDocId = new Map<number, Set<string>>();
    for (const doc of chunk) {
      const s = new Set<string>();
      if (doc.storageKey) s.add(doc.storageKey);
      if (doc.thumbKey) s.add(doc.thumbKey);
      keysByDocId.set(doc.id, s);
    }
    const versions = await db
      .select({ documentId: documentVersions.documentId, storageKey: documentVersions.storageKey })
      .from(documentVersions)
      .where(inArray(documentVersions.documentId, chunkIds));
    for (const v of versions) {
      if (v.storageKey) {
        keysByDocId.get(v.documentId)?.add(v.storageKey);
      }
    }

    // TOCTOU-safe delete: only delete rows that are STILL in the trash (deleted_at IS NOT NULL)
    const deletedRows = await db
      .delete(documents)
      .where(and(inArray(documents.id, chunkIds), isNotNull(documents.deletedAt)))
      .returning({ id: documents.id });

    if (deletedRows.length > 0) {
      totalPurged += deletedRows.length;
      const keysToUnlink = new Set<string>();
      for (const row of deletedRows) {
        const docKeys = keysByDocId.get(row.id);
        if (docKeys) {
          for (const k of docKeys) keysToUnlink.add(k);
        }
      }
      await unlinkPayloadKeys(keysToUnlink);
    }
  }

  if (totalPurged > 0) {
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "trash.empty",
      entityType: "document",
      entityId: 0,
      details: `تفريغ سلة المحذوفات (${totalPurged} مستند)`,
    });
  }
  revalidatePath("/trash");
}

export async function forceDeleteDocument(id: number): Promise<any> {
  const rawUser = await getCurrentUser();
  const perm = checkPermission(rawUser, "documents.force_delete");
  if (!perm.ok) return perm;
  const user = perm.user;

  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return;
  if (!canAccessDocument(user, doc)) return;
  // Explicit guard: never force-delete a live document that is not in the trash
  if (doc.deletedAt === null) return;

  const payloadKeys = await collectDocumentPayloadKeys([doc]);
  const deletedRows = await db
    .delete(documents)
    .where(and(eq(documents.id, id), isNotNull(documents.deletedAt)))
    .returning({ id: documents.id });

  if (deletedRows.length === 0) return;

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
  requirePermission(user, "documents.create", "يجب تسجيل الدخول لحفظ المستند الممسوح");
  const m = /^data:([^;]+);base64,(.*)$/.exec(input.dataUrl);
  if (!m) throw new Error("صيغة الصورة غير صحيحة");
  const mime = m[1];
  const base64Payload = m[2];

  // Pre-buffer Base64 size check to prevent memory exhaustion DoS
  const MAX_SCAN_SIZE = 20 * 1024 * 1024; // 20 MB
  const estimatedBytes = Math.floor((base64Payload.length * 3) / 4);
  if (estimatedBytes > MAX_SCAN_SIZE) {
    throw new Error(`حجم الملف يتجاوز الحد الأقصى ${MAX_SCAN_SIZE / 1024 / 1024} ميجابايت`);
  }

  const buf = Buffer.from(base64Payload, "base64");
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
  let thumbKey: string | null = null;
  try {
    await writeKey(key, buf);
    thumbKey = await createImageThumbnail(key);

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

    const id = await insertDocumentWithFirstVersion({
      doc: {
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
      },
      versionNote: "مسح ضوئي عبر جسر الماسحة",
      audit: {
        userId: user.id,
        userName: user.name,
        action: "document.scan",
        details: `إيداع مستند ممسوح: ${input.title}`,
      },
      writtenKeys: [key, thumbKey],
    });
    revalidatePath("/documents");
    return { id };
  } catch (err) {
    await removeStoredKeys([key, thumbKey]);
    throw err;
  }
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
  requirePermission(user, "documents.create", "يجب تسجيل الدخول لحفظ المستند الممسوح");
  const m = /^data:application\/pdf;base64,(.*)$/.exec(input.dataUrl);
  if (!m) throw new Error("صيغة ملف PDF غير صحيحة");
  const base64Payload = m[1];

  const MAX_SCAN_SIZE = 20 * 1024 * 1024; // 20 MB
  const estimatedBytes = Math.floor((base64Payload.length * 3) / 4);
  if (estimatedBytes > MAX_SCAN_SIZE) {
    throw new Error(`حجم الملف يتجاوز الحد الأقصى ${MAX_SCAN_SIZE / 1024 / 1024} ميجابايت`);
  }

  const buf = Buffer.from(base64Payload, "base64");
  if (buf.length < 5 || buf.toString("latin1", 0, 5) !== "%PDF-") {
    throw new Error("ملف PDF غير صالح");
  }

  if (buf.length > MAX_SCAN_SIZE) {
    throw new Error(`حجم الملف يتجاوز الحد الأقصى ${MAX_SCAN_SIZE / 1024 / 1024} ميجابايت`);
  }

  // Validate the target department/folder BEFORE persisting the bytes, so a
  // rejected scan never leaves an orphan file in storage/.
  const target = await resolveScanTarget(user, input.departmentId, input.folderId);

  const key = genKey("pdf");
  try {
    await writeKey(key, buf);

    const docTypeVal = (input.docType || "صورة ضوئية").trim();
    let docTypeId: number | null = null;
    const [typeRow] = await db
      .select({ id: docTypes.id })
      .from(docTypes)
      .where(eq(docTypes.name, docTypeVal))
      .limit(1);
    docTypeId = typeRow?.id ?? null;

    const id = await insertDocumentWithFirstVersion({
      doc: {
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
      },
      versionNote: `مسح ضوئي متعدد (${input.pageCount} صفحات) عبر نافذة الماسحة`,
      audit: {
        userId: user.id,
        userName: user.name,
        action: "document.scan",
        details: `إيداع مستند ممسوح PDF (${input.pageCount} صفحات): ${input.title}`,
      },
      writtenKeys: [key],
    });
    revalidatePath("/documents");
    return { id };
  } catch (err) {
    await removeStoredKeys([key]);
    throw err;
  }
}
