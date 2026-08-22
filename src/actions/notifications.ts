"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server";

export async function markNotificationRead(formData: FormData): Promise<void> {
  const notificationId = Number(formData.get("notificationId"));
  const user = await getCurrentUser();
  if (!user || !notificationId) return;
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)));
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.userId, user.id), sql`${notifications.readAt} IS NULL`));
  revalidatePath("/notifications");
}

export async function deleteReadNotifications(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, user.id), sql`${notifications.readAt} IS NOT NULL`));
  revalidatePath("/notifications");
}
