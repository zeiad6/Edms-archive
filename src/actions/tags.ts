"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, logAudit } from "@/lib/server";
import { requirePermission } from "@/lib/permissions";

export async function createTag(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "tags.manage");
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const color = String(formData.get("color") || "#64748b").trim();
  try {
    await db.insert(tags).values({ name, color });
  } catch {
    // unique constraint violation
    return;
  }
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "tag.create",
    entityType: "tag",
    details: `إنشاء وسم: ${name} (${color})`,
  });
  revalidatePath("/tags");
}

export async function updateTag(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "tags.manage");
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const color = String(formData.get("color") || "#64748b").trim();
  if (!id || !name) return;
  try {
    await db.update(tags).set({ name, color }).where(eq(tags.id, id));
  } catch {
    return;
  }
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "tag.update",
    entityType: "tag",
    entityId: id,
    details: `تحديث وسم: ${name}`,
  });
  revalidatePath("/tags");
}

export async function deleteTag(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "tags.manage");
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(tags).where(eq(tags.id, id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "tag.delete",
    entityType: "tag",
    entityId: id,
    details: "حذف وسم",
  });
  revalidatePath("/tags");
}
