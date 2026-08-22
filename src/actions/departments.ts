"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { departments, documents, folders, users, documentTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, logAudit } from "@/lib/server";
import { requirePermission } from "@/lib/permissions";

export async function createDepartment(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "departments.manage");
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const [row] = await db
    .insert(departments)
    .values({
      name,
      nameEn: (formData.get("nameEn") as string) || null,
      code: (formData.get("code") as string) || null,
      description: (formData.get("description") as string) || null,
      color: (formData.get("color") as string) || "#4f46e5",
    })
    .returning({ id: departments.id });
  await logAudit({
    userId: user?.id,
    userName: user?.name,
    action: "department.create",
    entityType: "department",
    entityId: row?.id,
    details: `إنشاء قسم جديد: ${name}`,
  });
  revalidatePath("/departments");
  revalidatePath("/", "layout");
}

export async function updateDepartment(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "departments.manage");
  const id = Number(formData.get("id"));
  if (!id) return;
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await db
    .update(departments)
    .set({
      name,
      nameEn: (formData.get("nameEn") as string) || null,
      code: (formData.get("code") as string) || null,
      description: (formData.get("description") as string) || null,
      color: (formData.get("color") as string) || "#4f46e5",
    })
    .where(eq(departments.id, id));
  await logAudit({
    userId: user?.id,
    userName: user?.name,
    action: "department.update",
    entityType: "department",
    entityId: id,
    details: `تحديث القسم: ${name}`,
  });
  revalidatePath("/departments");
}

export async function deleteDepartment(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "departments.manage");
  const id = Number(formData.get("id"));
  if (!id) return;
  // Reassign documents to uncategorised
  await db.update(documents).set({ departmentId: null }).where(eq(documents.departmentId, id));
  // Reassign folders to uncategorised
  await db.update(folders).set({ departmentId: null }).where(eq(folders.departmentId, id));
  // Unset users in this department
  await db.update(users).set({ departmentId: null }).where(eq(users.departmentId, id));
  // Detach templates referencing this department (FK constraint: no ON DELETE)
  await db
    .update(documentTemplates)
    .set({ departmentId: null })
    .where(eq(documentTemplates.departmentId, id));
  await db.delete(departments).where(eq(departments.id, id));
  await logAudit({
    userId: user?.id,
    userName: user?.name,
    action: "department.delete",
    entityType: "department",
    entityId: id,
    details: `حذف القسم`,
  });
  revalidatePath("/departments");
}
