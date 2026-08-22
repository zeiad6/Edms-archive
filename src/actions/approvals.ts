"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { documents, approvalRequests, notifications, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser, logAudit, canAccessDocument } from "@/lib/server";
import { requirePermission } from "@/lib/permissions";

async function createNotification(userId: number, type: string, title: string, message: string, documentId?: number, referenceId?: number) {
  await db.insert(notifications).values({
    userId,
    type: type as any,
    title,
    message,
    documentId: documentId ?? null,
    referenceId: referenceId ?? null,
    createdAt: new Date().toISOString(),
  });
}

async function getDocTitle(docId: number): Promise<string> {
  const [d] = await db.select({ title: documents.title }).from(documents).where(eq(documents.id, docId)).limit(1);
  return d?.title ?? "مستند";
}

export async function submitForApproval(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("يجب تسجيل الدخول");

  const documentId = Number(formData.get("documentId"));
  const assignedToId = Number(formData.get("assignedToId"));
  const comment = String(formData.get("comment") || "");

  if (!documentId || !assignedToId) throw new Error("الرجاء اختيار المستخدم المسؤول عن الموافقة");

  // check document exists
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) throw new Error("المستند غير موجود");

  // the requester must be able to access the document they are submitting
  if (!canAccessDocument(user, doc)) throw new Error("لا تملك صلاحية الوصول لهذا المستند");

  // check the assigned approver exists and is qualified to approve
  const [assignee] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, assignedToId))
    .limit(1);
  if (!assignee) throw new Error("المستخدم المسؤول عن الموافقة غير موجود");
  if (assignee.role !== "admin" && assignee.role !== "manager") {
    throw new Error("المستخدم غير مؤهل للموافقة");
  }

  // check not already pending
  const [existing] = await db
    .select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(sql`${approvalRequests.documentId} = ${documentId} AND ${approvalRequests.status} = 'pending'`)
    .limit(1);
  if (existing) throw new Error("يوجد طلب موافقة معلق لهذا المستند بالفعل");

  await db.insert(approvalRequests).values({
    documentId,
    requestedById: user.id,
    assignedToId,
    comment: comment || "يرجى الموافقة على هذا المستند",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "approval.submit",
    entityType: "document",
    entityId: documentId,
    details: "إرسال المستند للموافقة",
  });

  const docTitle = await getDocTitle(documentId);
  await createNotification(
    assignedToId,
    "approval_requested",
    "طلب موافقة جديد",
    `طلب منك ${user.name} الموافقة على المستند: ${docTitle}`,
    documentId,
  );

  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/approvals");
}

export async function approveDocument(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "approvals.manage");

  const requestId = Number(formData.get("requestId"));
  const responseNote = String(formData.get("responseNote") || "");

  const [req] = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, requestId))
    .limit(1);
  if (!req) throw new Error("طلب الموافقة غير موجود");
  if (req.status !== "pending") throw new Error("تمت المعالجة بالفعل");

  // Only the assigned approver may act — admin may act on any request.
  if (user.role !== "admin" && req.assignedToId !== user.id) {
    throw new Error("هذا الطلب موكَل إلى مستخدم آخر — لا يمكنك اعتماده");
  }

  await db
    .update(approvalRequests)
    .set({
      status: "approved",
      responseNote: responseNote || null,
      respondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(approvalRequests.id, requestId));

  // auto-promote document status if it was pending_review
  await db
    .update(documents)
    .set({ status: "active", updatedAt: new Date().toISOString() })
    .where(sql`${documents.id} = ${req.documentId} AND ${documents.status} = 'pending_review'`);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "approval.approve",
    entityType: "document",
    entityId: req.documentId,
    details: responseNote
      ? `تمت الموافقة على المستند مع ملاحظة: ${responseNote.slice(0, 100)}`
      : "تمت الموافقة على المستند",
  });

  const docTitle = await getDocTitle(req.documentId);
  await createNotification(
    req.requestedById,
    "approval_approved",
    "تمت الموافقة على المستند",
    `وافق ${user.name} على المستند: ${docTitle}`,
    req.documentId,
  );

  revalidatePath("/documents");
  revalidatePath("/approvals");
  revalidatePath(`/documents/${req.documentId}`);
}

export async function rejectDocument(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "approvals.manage");

  const requestId = Number(formData.get("requestId"));
  const responseNote = String(formData.get("responseNote") || "");

  if (!responseNote) throw new Error("يرجى كتابة سبب الرفض");

  const [req] = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, requestId))
    .limit(1);
  if (!req) throw new Error("طلب الموافقة غير موجود");
  if (req.status !== "pending") throw new Error("تمت المعالجة بالفعل");

  // Only the assigned approver may act — admin may act on any request.
  if (user.role !== "admin" && req.assignedToId !== user.id) {
    throw new Error("هذا الطلب موكَل إلى مستخدم آخر — لا يمكنك رفضه");
  }

  await db
    .update(approvalRequests)
    .set({
      status: "rejected",
      responseNote,
      respondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(approvalRequests.id, requestId));

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "approval.reject",
    entityType: "document",
    entityId: req.documentId,
    details: responseNote
      ? `تم رفض المستند: ${responseNote.slice(0, 100)}`
      : "تم رفض المستند",
  });

  const docTitle = await getDocTitle(req.documentId);
  await createNotification(
    req.requestedById,
    "approval_rejected",
    "تم رفض المستند",
    `رفض ${user.name} المستند "${docTitle}"، السبب: ${responseNote.slice(0, 80)}`,
    req.documentId,
  );

  revalidatePath("/documents");
  revalidatePath("/approvals");
  revalidatePath(`/documents/${req.documentId}`);
}
