"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, logAudit } from "@/lib/server";
import { requirePermission } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "@/lib/password";

/** Minimum accepted password length (mirrors `changePassword`). */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Detect a UNIQUE constraint violation raised by libsql for a specific
 * column (e.g. `users.username`). libsql reports it as
 * `UNIQUE constraint failed: users.<column>` in the error message.
 */
function uniqueViolation(err: unknown, column: "username" | "email"): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("UNIQUE constraint failed") &&
    err.message.includes(`users.${column}`)
  );
}

/**
 * Translate a unique-constraint violation into a user-facing Arabic error.
 * Falls back to rethrowing the original error when it is not a constraint issue.
 */
function throwUserError(err: unknown): never {
  if (uniqueViolation(err, "username")) throw new Error("اسم الدخول مستخدم مسبقاً");
  if (uniqueViolation(err, "email")) throw new Error("البريد الإلكتروني مستخدم مسبقاً");
  throw err;
}

export async function updateUser(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "users.manage");
  const id = Number(formData.get("id"));
  if (!id) throw new Error("معرّف المستخدم مطلوب");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const newPassword = String(formData.get("newPassword") || "");
  if (!name) throw new Error("الاسم الكامل مطلوب");
  if (!email) throw new Error("البريد الإلكتروني مطلوب");
  if (!username) throw new Error("اسم الدخول مطلوب");
  if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
  }
  const dept = formData.get("departmentId");
  const rawRole = String(formData.get("role") || "staff");
  const role = (["admin", "manager", "staff"].includes(rawRole) ? rawRole : "staff") as "admin" | "manager" | "staff";
  const set: Partial<typeof users.$inferInsert> = {
    name,
    email,
    username,
    jobTitle: (formData.get("jobTitle") as string) || null,
    role,
    departmentId: dept ? Number(dept) : null,
    active: formData.get("active") === "on" ? 1 : 0,
  };
  // Optional password reset: an empty field leaves the password untouched.
  // A non-empty value is hashed and forces the user to change it on next login.
  if (newPassword) {
    set.passwordHash = hashPassword(newPassword);
    set.mustChangePassword = 1;
  }
  try {
    await db
      .update(users)
      .set(set)
      .where(eq(users.id, id));
  } catch (err) {
    throwUserError(err);
  }
  await logAudit({
    userId: user?.id,
    userName: user?.name,
    action: "user.update",
    entityType: "user",
    entityId: id,
    details: `تحديث بيانات المستخدم: ${name}`,
  });
  revalidatePath("/users");
}

export async function deleteUser(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "users.manage");
  const id = Number(formData.get("id"));
  if (!id) return;
  // Guard: an admin must not delete their own account (would orphan the session).
  if (id === user.id) return;
  // Reassign documents to self before deleting
  await db.update(documents).set({ uploadedById: user.id }).where(eq(documents.uploadedById, id));
  await db.delete(users).where(eq(users.id, id));
  await logAudit({
    userId: user?.id,
    userName: user?.name,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    details: `حذف مستخدم`,
  });
  revalidatePath("/users");
}

export async function createUser(formData: FormData) {
  const user = await getCurrentUser();
  requirePermission(user, "users.manage");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!name) throw new Error("الاسم الكامل مطلوب");
  if (!email) throw new Error("البريد الإلكتروني مطلوب");
  if (!username) throw new Error("اسم الدخول مطلوب");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
  }
  const dept = formData.get("departmentId");
  const colors = ["#4f46e5", "#059669", "#d97706", "#0ea5e9", "#be123c", "#7c3aed", "#6366f1"];
  let row: { id: number } | undefined;
  try {
    // Store the scrypt hash and force a password change on first login —
    // the admin-set password is temporary until the user picks their own.
    [row] = await db
      .insert(users)
      .values({
        name,
        username,
        email,
        jobTitle: (formData.get("jobTitle") as string) || null,
        role: (formData.get("role") as "admin" | "manager" | "staff") || "staff",
        departmentId: dept ? Number(dept) : null,
        avatarColor: colors[randomInt(colors.length)],
        passwordHash: hashPassword(password),
        mustChangePassword: 1,
      })
      .returning({ id: users.id });
  } catch (err) {
    throwUserError(err);
  }
  await logAudit({
    userId: user?.id,
    userName: user?.name,
    action: "user.create",
    entityType: "user",
    entityId: row?.id,
    details: `إضافة مستخدم: ${name}`,
  });
  revalidatePath("/users");
}

/**
 * Let the authenticated user change their own password.
 *
 * Self-service only: the action operates on the current user (from the
 * session), never on a form-supplied ID — no admin override. Verifies the
 * current password (constant-time) and enforces a minimum length of 8
 * characters on the new one. On success the hash is updated and the
 * `mustChangePassword` flag is cleared.
 *
 * NOTE (integration): after `loginUser` succeeds, call this flow when the
 * session user has `mustChangePassword` set — the UI should force the
 * password-change form before showing the rest of the app.
 */
export async function changePassword(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return; // must be logged in — only the user themselves
  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  // Constant-time check; users without a stored hash cannot change via this path.
  if (!user.passwordHash || !verifyPassword(current, user.passwordHash)) return;
  if (next.length < 8) return; // minimum password length
  await db
    .update(users)
    .set({ passwordHash: hashPassword(next), mustChangePassword: 0 })
    .where(eq(users.id, user.id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "user.change_password",
    entityType: "user",
    entityId: user.id,
    details: "تغيير كلمة المرور",
  });
}
