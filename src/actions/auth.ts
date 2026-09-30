"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, sanitizePastedPassword, verifyPassword } from "@/lib/password";
import { clearLoginFailures, loginThrottled, recordLoginFailure } from "@/lib/login-throttle";
import { getCurrentUser, logAudit } from "@/lib/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/session";

/**
 * In-memory login brute-force guard: 8 failed attempts per account per
 * 10 minutes, then a generic cool-down error. Keyed by account (not IP —
 * server actions have no reliable client IP), counted ONLY on failure so
 * legitimate users are never throttled.
 *
 * Single-process scope: the packaged/Electron and standalone deployments run
 * exactly one Node process, so a Map is sufficient. A multi-process
 * deployment in front of one DB must replace this with a shared store
 * (SQLite table / Redis) — see the comment on deployment in README.
 */
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
 * Admins switch WITHOUT the target user's password (impersonation): the
 * current session is verified server-side (`current.role === 'admin'`) and
 * the switch is audit-logged. Anonymous callers on /login must still supply
 * and verify the target user's password. Signed-in non-admins are rejected
 * server-side, even if they forge the request body — the shell also hides
 * the picker from them.
 */
export async function switchUser(
  prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const id = Number(formData.get("userId"));

  const current = await getCurrentUser();
  if (current && current.role !== "admin") {
    revalidatePath("/", "layout");
    return {};
  }
  const isAdminSwitch = !!current && current.role === "admin";

  // One generic error for unknown user / missing hash / wrong password —
  // never leak which part failed.
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "كلمة المرور غير صحيحة" };
  }

  const throttleKey = `uid:${Number.isInteger(id) && id > 0 ? id : "?"}`;
  if (loginThrottled(throttleKey)) {
    return { error: "محاولات كثيرة — حاول مجدداً بعد 10 دقائق" };
  }

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const u = rows[0];

  // Admin impersonation: no target password required. Throttle and
  // active-check are preserved; the switch is audit-logged.
  if (isAdminSwitch) {
    if (!u) {
      recordLoginFailure(throttleKey);
      return { error: "كلمة المرور غير صحيحة" };
    }
    clearLoginFailures(throttleKey);
    if (!u.active) {
      return { error: "هذا الحساب معطّل. تواصل مع مدير النظام." };
    }

    const store = await cookies();
    store.set(SESSION_COOKIE, signSession(String(u.id)), SESSION_COOKIE_OPTIONS);
    await logAudit({
      userId: current!.id,
      userName: current!.name,
      action: "auth.switch_user",
      entityType: "user",
      entityId: u.id,
      details: `تبديل الهوية إلى: ${u.name}`,
    });
    revalidatePath("/", "layout");
    return {};
  }

  const password = sanitizePastedPassword(String(formData.get("password") || ""));
  if (!u?.passwordHash || !(await verifyPassword(password, u.passwordHash))) {
    recordLoginFailure(throttleKey);
    return { error: "كلمة المرور غير صحيحة" };
  }
  clearLoginFailures(throttleKey);
  if (!u.active) {
    return { error: "هذا الحساب معطّل. تواصل مع مدير النظام." };
  }

  // Same forced-change gate as `loginUser` (auth.ts:156). Without it the
  // picker is a complete bypass of the first-login password change: the
  // seeded accounts ship with the shared DEFAULT_PASSWORD and
  // `must_change_password = 1`, so anyone who knows that constant could
  // take a session over the picker and never be asked to change it.
  // Send them to the username/password form, which owns the change flow.
  if (u.mustChangePassword === 1) {
    return {
      error: "يجب تغيير كلمة المرور الافتراضية أولاً — استخدم تبويب «تسجيل الدخول» باسم المستخدم.",
    };
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
  const password = sanitizePastedPassword(String(formData.get("password") || ""));

  const throttleKey = `user:${username || "?"}`;
  if (loginThrottled(throttleKey)) {
    return { error: "محاولات كثيرة — حاول مجدداً بعد 10 دقائق" };
  }

  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const u = rows[0];
  if (!u?.passwordHash || !(await verifyPassword(password, u.passwordHash))) {
    recordLoginFailure(throttleKey);
    return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }
  clearLoginFailures(throttleKey);
  if (!u.active) {
    return { error: "هذا الحساب معطّل. تواصل مع مدير النظام." };
  }

  // Forced password change on first login: no session until the default
  // password is replaced. The change step re-submits this same action with
  // `newPassword` (+ `confirmPassword`) alongside the hidden username and
  // current password, which are re-verified by the credential check above.
  if (u.mustChangePassword === 1) {
    // Sanitize both fields with the SAME helper used at login verification:
    // an RTL paste can wrap the new password in spaces/LRM/RLM/zero-width
    // marks; storing it raw then verifying the sanitized form on the next
    // login would reject a correct password. sanitizePastedPassword only
    // strips surrounding noise (inner content untouched) so comparison and
    // storage stay consistent.
    const next = sanitizePastedPassword(String(formData.get("newPassword") || ""));
    const confirm = sanitizePastedPassword(String(formData.get("confirmPassword") || ""));
    if (!next) {
      return { error: "يجب تغيير كلمة المرور الافتراضية أولاً", mustChange: true };
    }
    if (next.length < 8) {
      return { error: "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف", mustChange: true };
    }
    if (next !== confirm) {
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

