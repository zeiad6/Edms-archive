import { cookies } from "next/headers";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { db } from "@/db";
import { users, auditLogs, approvalRequests, notifications, documents } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import type { User, Document } from "@/db/schema";

// ---------------------------------------------------------------------------
// Object storage (MinIO-compatible). The binary never lives in the DB — only
// the storage key does. Files are served exclusively through a permission-
// checking streaming route.
// ---------------------------------------------------------------------------

/**
 * Absolute path to the on-disk storage root.
 * Defaults to `<cwd>/storage`; the Electron shell overrides it via
 * `EDMS_STORAGE_DIR` (an asar payload is read-only, so the packaged app
 * redirects user data to the OS userData folder).
 */
export const STORAGE_DIR = process.env.EDMS_STORAGE_DIR
  ? path.resolve(process.env.EDMS_STORAGE_DIR)
  : path.join(process.cwd(), "storage");

/**
 * Ensure that the storage sub-directories exist.
 * Safe to call multiple times — `recursive: true` is idempotent.
 */
export async function ensureStorage(): Promise<void> {
  await fs.mkdir(path.join(STORAGE_DIR, "documents"), { recursive: true });
  await fs.mkdir(path.join(STORAGE_DIR, "thumbnails"), { recursive: true });
}

/**
 * Generate a unique, date-partitioned storage key for a new file.
 *
 * Format: `documents/YYYY/MM/<random-hex>.<ext>`
 *
 * @param ext - File extension without the leading dot (e.g. `"pdf"`).
 * @returns A storage key relative to {@link STORAGE_DIR}.
 */
export function genKey(ext: string): string {
  const id = crypto.randomBytes(10).toString("hex");
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `documents/${y}/${m}/${id}.${ext}`;
}

/**
 * Resolve a relative storage key to an absolute path, rejecting traversal.
 *
 * @param key - Relative storage key (e.g. `"documents/2026/01/abc123.pdf"`).
 * @returns Absolute filesystem path.
 * @throws {Error} If the key resolves outside {@link STORAGE_DIR}.
 */
export function resolveKey(key: string): string {
  const abs = path.resolve(STORAGE_DIR, key);
  const rel = path.relative(STORAGE_DIR, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("invalid storage key");
  }
  return abs;
}

/**
 * Write binary data to a storage key, creating intermediate directories.
 *
 * @param key - Relative storage key (as returned by {@link genKey}).
 * @param data - Raw file buffer to persist.
 */
export async function writeKey(key: string, data: Buffer): Promise<void> {
  await ensureStorage();
  const abs = resolveKey(key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
}

// ---------------------------------------------------------------------------
// Session (lightweight, demo): the active operator is chosen via a cookie.
// In production this is replaced by ASP.NET Core identity / JWT.
// ---------------------------------------------------------------------------

/**
 * Get the current authenticated user from the session cookie.
 *
 * Reads the `edms_uid` cookie, verifies its HMAC signature
 * ({@link verifySession}), parses the user ID, and fetches the user record
 * from the database. Returns `null` if the cookie is missing, unsigned or
 * tampered, invalid, or the user does not exist.
 *
 * @returns The authenticated user, or null if not logged in.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const store = await cookies();
    const raw = store.get(SESSION_COOKIE)?.value;
    if (!raw) return null; // لا يوجد كوكي = غير مسجل دخول
    const uid = verifySession(raw);
    if (!uid) return null; // كوكي مزوّر أو غير موقّع = غير مسجل دخول
    const id = Number.parseInt(uid, 10);
    if (!Number.isFinite(id) || id < 1) return null;
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const u = rows[0];
    // Disabled accounts must not keep a valid session.
    if (!u || !u.active) return null;
    return u;
  } catch (e) {
    // cookie missing or DB unreachable — treat as unauthenticated
    console.error("[getCurrentUser] error:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Role-based access control.
// ---------------------------------------------------------------------------

/**
 * Check if a user is allowed to access a document based on RBAC rules.
 *
 * Rules (in order):
 * 1. `null` user → denied.
 * 2. `admin` → always allowed.
 * 3. `staff` cannot access `confidential` documents outside their department.
 * 4. Otherwise allowed if the document belongs to the user's department or
 *    was uploaded by the user.
 */
export function canAccessDocument(user: User | null, doc: Document): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (doc.confidential && user.role === "staff") return false;
  return doc.departmentId === user.departmentId || doc.uploadedById === user.id;
}

/**
 * Load the requested documents and split them into the ones the caller may act
 * on and the ones they may not.
 *
 * Four call sites used to inline this pipeline — select by ids → filter
 * through {@link canAccessDocument} → report the skipped count — each with a
 * slightly different error string. The permission gate is the single most
 * security-relevant block in the codebase, so four hand-maintained copies is
 * four chances to tighten one and forget another. One helper makes it
 * testable once and keeps the rule in one place next to its definition.
 *
 * Ids that do not exist are indistinguishable from ids the caller may not see
 * (both land in `skipped`) — reporting them separately would let a caller
 * probe which ids are real.
 *
 * @param user - The authenticated caller.
 * @param ids - Requested document ids.
 * @param opts.excludeDeleted - Drop soft-deleted (trashed) rows.
 * @returns `accessible` documents, how many requested ids did not come back
 *   accessible, and how many rows actually matched the ids at all. The last
 *   number is what lets a route keep the distinction between "no such document"
 *   (404) and "exists but you may not see it" (403) without re-running the
 *   query it was avoiding.
 */
export async function loadAccessibleDocs(
  user: User | null,
  ids: number[],
  opts: { excludeDeleted?: boolean } = {}
): Promise<{ accessible: Document[]; skipped: number; found: number }> {
  if (!user || ids.length === 0) return { accessible: [], skipped: ids.length, found: 0 };
  const rows = await db
    .select()
    .from(documents)
    .where(inArray(documents.id, ids));
  const accessible = rows.filter(
    (doc) => canAccessDocument(user, doc) && !(opts.excludeDeleted && doc.deletedAt)
  );
  return { accessible, skipped: ids.length - accessible.length, found: rows.length };
}

// ---------------------------------------------------------------------------
// Audit trail.
// ---------------------------------------------------------------------------

/**
 * Insert an audit-log entry. Never throws — audit failures are logged to
 * stderr and silently swallowed so they never break the request.
 *
 * @param entry - The audit event to record.
 * @param entry.action - Verb describing the action (e.g. `"document.create"`).
 * @param entry.entityType - Optional entity kind (e.g. `"document"`).
 * @param entry.entityId - Optional primary key of the affected entity.
 * @param entry.details - Optional free-text detail (JSON string, diff, etc.).
 */
export async function logAudit(entry: {
  userId?: number | null;
  userName?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  details?: string | null;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      userName: entry.userName ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details ?? null,
    });
  } catch (e) {
    // audit must never break the request
    console.error("[logAudit] error:", e);
  }
}

/**
 * Return the count of unread notifications for a user.
 *
 * @param userId - The user's numeric ID. Returns `0` if falsy.
 * @returns The number of notifications where `read_at IS NULL`.
 */
export async function getUnreadNotificationCount(userId?: number): Promise<number> {
  if (!userId) return 0;
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(sql`${notifications.userId} = ${userId} AND ${notifications.readAt} IS NULL`);
    return row?.count ?? 0;
  } catch {
    // query failure — badge hides gracefully, don't crash the shell
    return 0;
  }
}

/**
 * Return the count of pending approval requests assigned to a user.
 *
 * @param userId - The user's numeric ID. Returns `0` if falsy.
 * @returns The number of `approval_requests` with `status = 'pending'`
 *          assigned to this user.
 */
export async function getPendingApprovalCount(userId?: number): Promise<number> {
  if (!userId) return 0;
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(approvalRequests)
      .where(
        sql`${approvalRequests.assignedToId} = ${userId} AND ${approvalRequests.status} = 'pending'`
      );
    return row?.count ?? 0;
  } catch {
    // query failure — badge hides gracefully, don't crash the shell
    return 0;
  }
}


