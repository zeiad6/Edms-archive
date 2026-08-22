"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { documents, documentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, logAudit } from "@/lib/server";
import { can } from "@/lib/permissions";
import { createImageThumbnail } from "@/lib/thumbnails";

export async function restoreVersion(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("يجب تسجيل الدخول");

  const docId = Number(formData.get("documentId"));
  const versionId = Number(formData.get("versionId"));
  if (!docId || !versionId) throw new Error("بيانات غير صالحة");

  const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  if (!doc) throw new Error("المستند غير موجود");

  const canWrite = can(user, "documents.restore") || doc.uploadedById === user.id;
  if (!canWrite) throw new Error("لا تملك صلاحية استرجاع الإصدار");

  const [ver] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);
  if (!ver || ver.documentId !== docId) throw new Error("الإصدار غير موجود");

  // Swap the document's current storage key with the version's
  const thumbKey = doc.mimeType?.startsWith("image/")
    ? (await createImageThumbnail(ver.storageKey)) ?? ver.storageKey
    : doc.thumbKey;
  await db
    .update(documents)
    .set({
      storageKey: ver.storageKey,
      originalName: ver.originalName,
      fileSize: ver.fileSize,
      fileName: ver.storageKey.split("/").pop()!,
      thumbKey,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(documents.id, docId));

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "document.restore",
    entityType: "document",
    entityId: docId,
    details: `استرجاع الإصدار ${ver.version}: ${ver.originalName}`,
  });

  revalidatePath(`/documents/${docId}`);
  revalidatePath("/documents");
}
