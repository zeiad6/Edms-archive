"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getCurrentUser, logAudit } from "@/lib/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/session";

export async function logoutUser() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  revalidatePath("/", "layout");
  // Must land on /login: without it the user stays on a protected page with
  // no Shell, and the proxy's no-cookie auto-login would silently re-sign
  // them in as admin on the next request.
  redirect("/login");
}

/**
 * Identity switch with password verification. Allowed for:
 * - anonymous visitors on /login (the quick-picker tab is the demo entry
 *   point — there is no identity to restrict yet), and
 * - admins (who may simulate any role from the shell).
 *
 * The target user's password is required and verified before the session is
 * issued — picking a user no longer grants direct access. Signed-in
 * non-admins are rejected server-side, even if they forge the request body —
 * the shell also hides the picker from them.
 */
export async function switchUser(
  prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const id = Number(formData.get("userId"));
  const password = String(formData.get("password") || "");

  const current = await getCurrentUser();
  if (current && current.role !== "admin") {
    revalidatePath("/", "layout");
    return {};
  }

  // One generic error for unknown user / missing hash / wrong password —
  // never leak which part failed.
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "كلمة المرور غير صحيحة" };
  }

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const u = rows[0];
  if (!u?.passwordHash || !(await verifyPassword(password, u.passwordHash))) {
    return { error: "كلمة المرور غير صحيحة" };
  }
  if (!u.active) {
    return { error: "هذا الحساب معطّل. تواصل مع مدير النظام." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(String(u.id)), SESSION_COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  return {};
}

/**
 * Username + password login. Returns an error message or redirects.
 *
 * Forced first-login password change: when the account still carries the
 * default password (`mustChangePassword === 1`) NO session cookie is issued
 * and the action returns `{ error, mustChange: true }` so the login form can
 * switch to the change-password step. The change itself is handled by this
 * same action on the next submit (the form re-sends username + current
 * password as hidden fields plus the new password) — `changePassword` in
 * `users.ts` cannot be used here because it requires an existing session,
 * which we deliberately refuse to grant until the flag is cleared.
 */
export async function loginUser(
  prevState: { error?: string; mustChange?: boolean; success?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; mustChange?: boolean; success?: string }> {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const u = rows[0];
  if (!u?.passwordHash || !(await verifyPassword(password, u.passwordHash))) {
    return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }
  if (!u.active) {
    return { error: "هذا الحساب معطّل. تواصل مع مدير النظام." };
  }

  // Forced password change on first login: no session until the default
  // password is replaced. The change step re-submits this same action with
  // `newPassword` (+ `confirmPassword`) alongside the hidden username and
  // current password, which are re-verified by the credential check above.
  if (u.mustChangePassword === 1) {
    const next = String(formData.get("newPassword") || "");
    if (!next) {
      return { error: "يجب تغيير كلمة المرور الافتراضية أولاً", mustChange: true };
    }
    if (next.length < 8) {
      return { error: "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف", mustChange: true };
    }
    if (next !== String(formData.get("confirmPassword") || "")) {
      return { error: "تأكيد كلمة المرور غير مطابق", mustChange: true };
    }
    await db
      .update(users)
      .set({ passwordHash: hashPassword(next), mustChangePassword: 0 })
      .where(eq(users.id, u.id));
    await logAudit({
      userId: u.id,
      userName: u.name,
      action: "user.change_password",
      entityType: "user",
      entityId: u.id,
      details: "تغيير كلمة المرور (أول تسجيل دخول)",
    });
    return { success: "تم تغيير كلمة المرور، سجّل دخولك" };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(String(u.id)), SESSION_COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/");
}

