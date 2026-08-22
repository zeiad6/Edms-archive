/**
 * RBAC permission definitions for the EDMS.
 *
 * Each permission key maps to a list of roles that are allowed to perform it.
 * Use `can(user, "permission.key")` in server actions and API routes.
 */

import type { User } from "@/db/schema";

/**
 * RBAC permission map: each key maps to an array of roles allowed to
 * perform that action.  Use `can(user, key)` for a boolean check or
 * `requirePermission(user, key)` to throw on denial.
 *
 * Roles (from most to least privileged): `admin`, `manager`, `staff`.
 */
export const PERMISSIONS = {
  // Documents
  "documents.create":        ["admin", "manager", "staff"],
  /** Read documents from any department */
  "documents.read_all":      ["admin", "manager"],
  /** Update any document (not just own) */
  "documents.update_all":    ["admin"],
  "documents.delete":        ["admin", "manager"],
  "documents.archive":       ["admin", "manager"],
  "documents.restore":       ["admin", "manager"],
  "documents.force_delete":  ["admin"],

  // Departments
  "departments.view":        ["admin", "manager", "staff"],
  "departments.manage":      ["admin"],

  // Users
  "users.view":              ["admin", "manager"],
  "users.manage":            ["admin"],

  // Folders
  "folders.manage":          ["admin", "manager"],
  "folders.view":            ["admin", "manager", "staff"],

  // Tags
  "tags.manage":             ["admin", "manager"],

  // Document types
  "doc-types.manage":        ["admin", "manager"],

  // Templates
  "templates.view":          ["admin", "manager", "staff"],
  "templates.manage":        ["admin", "manager"],

  // Approvals
  "approvals.manage":        ["admin", "manager"],

  // Settings
  "settings.view":           ["admin"],
  "settings.manage":         ["admin"],

  // Audit
  "audit.view":              ["admin"],

  // Reports
  "reports.view":            ["admin", "manager"],

  // Trash
  "trash.view":              ["admin", "manager"],
  "trash.purge":             ["admin"],

  // Permissions (view for admins + managers, edit for admins only)
  "permissions.view":        ["admin", "manager"],
  "permissions.manage":      ["admin"],
} as const;

/** Union type of all valid permission keys (e.g. `"documents.create"`). */
export type PermissionKey = keyof typeof PERMISSIONS;

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Check whether a user has the given permission.
 * Returns `true` / `false`.
 */
export function can(user: User | null, permission: PermissionKey): boolean {
  if (!user) return false;
  const allowed = PERMISSIONS[permission] as readonly string[] | undefined;
  if (!allowed) return false;
  return allowed.includes(user.role);
}

/**
 * Throw a JSON-friendly error if the user lacks the permission.
 * Call from API routes / server actions.
 */
export function requirePermission(
  user: User | null,
  permission: PermissionKey,
  message?: string,
): asserts user is User {
  if (!user) {
    const err = new Error(message ?? "يجب تسجيل الدخول");
    (err as any).status = 401;
    throw err;
  }
  if (!can(user, permission)) {
    const err = new Error(message ?? "ليس لديك صلاحية لهذه العملية");
    (err as any).status = 403;
    throw err;
  }
}

/**
 * Arabic label for each permission (used in the permissions UI).
 */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "documents.create": "إنشاء مستندات",
  "documents.read_all": "قراءة كل المستندات",
  "documents.update_all": "تعديل أي مستند",
  "documents.delete": "حذف المستندات",
  "documents.archive": "أرشفة المستندات",
  "documents.restore": "استعادة المستندات",
  "documents.force_delete": "حذف نهائي",
  "departments.view": "عرض الأقسام",
  "departments.manage": "إدارة الأقسام",
  "users.view": "عرض المستخدمين",
  "users.manage": "إدارة المستخدمين",
  "folders.view": "عرض المجلدات",
  "folders.manage": "إدارة المجلدات",
  "tags.manage": "إدارة الوسوم",
  "doc-types.manage": "إدارة التصنيفات",
  "templates.view": "عرض القوالب",
  "templates.manage": "إدارة القوالب",
  "approvals.manage": "إدارة الموافقات",
  "settings.view": "عرض الإعدادات",
  "settings.manage": "إدارة الإعدادات",
  "audit.view": "عرض سجل النشاط",
  "reports.view": "عرض التقارير",
  "trash.view": "عرض سلة المحذوفات",
  "trash.purge": "تفريغ السلة",
  "permissions.view": "عرض الصلاحيات",
  "permissions.manage": "تعديل الصلاحيات",
};

/**
 * Map each role to its human-readable label (kept in sync with ROLE_META).
 */
export const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  manager: "مشرف قسم",
  staff: "موظف",
};
