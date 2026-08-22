import { describe, it, expect } from "vitest";
import {
  can,
  requirePermission,
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type PermissionKey,
} from "@/lib/permissions";
import type { User } from "@/db/schema";

// ─── Helpers ──────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    name: "Test User",
    email: "test@example.com",
    role: "staff",
    departmentId: 1,
    active: 1,
    createdAt: "2026-01-01",
    ...overrides,
  }) as unknown as User;

const admin = makeUser({ id: 1, role: "admin" });
const manager = makeUser({ id: 2, role: "manager" });
const staff = makeUser({ id: 3, role: "staff" });

// ─── can() ────────────────────────────────────────────────────────────

describe("can", () => {
  // --- null / undefined user ---
  it("returns false for null user", () => {
    expect(can(null, "documents.create")).toBe(false);
  });

  // --- documents.create (all roles) ---
  describe("documents.create", () => {
    it("allows admin", () => expect(can(admin, "documents.create")).toBe(true));
    it("allows manager", () => expect(can(manager, "documents.create")).toBe(true));
    it("allows staff", () => expect(can(staff, "documents.create")).toBe(true));
  });

  // --- documents.read_all (admin + manager) ---
  describe("documents.read_all", () => {
    it("allows admin", () => expect(can(admin, "documents.read_all")).toBe(true));
    it("allows manager", () => expect(can(manager, "documents.read_all")).toBe(true));
    it("denies staff", () => expect(can(staff, "documents.read_all")).toBe(false));
  });

  // --- documents.update_all (admin only) ---
  describe("documents.update_all", () => {
    it("allows admin", () => expect(can(admin, "documents.update_all")).toBe(true));
    it("denies manager", () => expect(can(manager, "documents.update_all")).toBe(false));
    it("denies staff", () => expect(can(staff, "documents.update_all")).toBe(false));
  });

  // --- documents.delete (admin + manager) ---
  describe("documents.delete", () => {
    it("allows admin", () => expect(can(admin, "documents.delete")).toBe(true));
    it("allows manager", () => expect(can(manager, "documents.delete")).toBe(true));
    it("denies staff", () => expect(can(staff, "documents.delete")).toBe(false));
  });

  // --- documents.force_delete (admin only) ---
  describe("documents.force_delete", () => {
    it("allows admin", () => expect(can(admin, "documents.force_delete")).toBe(true));
    it("denies manager", () => expect(can(manager, "documents.force_delete")).toBe(false));
    it("denies staff", () => expect(can(staff, "documents.force_delete")).toBe(false));
  });

  // --- departments.manage (admin only) ---
  describe("departments.manage", () => {
    it("allows admin", () => expect(can(admin, "departments.manage")).toBe(true));
    it("denies manager", () => expect(can(manager, "departments.manage")).toBe(false));
    it("denies staff", () => expect(can(staff, "departments.manage")).toBe(false));
  });

  // --- departments.view (all roles) ---
  describe("departments.view", () => {
    it("allows admin", () => expect(can(admin, "departments.view")).toBe(true));
    it("allows manager", () => expect(can(manager, "departments.view")).toBe(true));
    it("allows staff", () => expect(can(staff, "departments.view")).toBe(true));
  });

  // --- users.view (admin + manager) ---
  describe("users.view", () => {
    it("allows admin", () => expect(can(admin, "users.view")).toBe(true));
    it("allows manager", () => expect(can(manager, "users.view")).toBe(true));
    it("denies staff", () => expect(can(staff, "users.view")).toBe(false));
  });

  // --- users.manage (admin only) ---
  describe("users.manage", () => {
    it("allows admin", () => expect(can(admin, "users.manage")).toBe(true));
    it("denies manager", () => expect(can(manager, "users.manage")).toBe(false));
    it("denies staff", () => expect(can(staff, "users.manage")).toBe(false));
  });

  // --- settings.view (admin only) ---
  describe("settings.view", () => {
    it("allows admin", () => expect(can(admin, "settings.view")).toBe(true));
    it("denies manager", () => expect(can(manager, "settings.view")).toBe(false));
    it("denies staff", () => expect(can(staff, "settings.view")).toBe(false));
  });

  // --- audit.view (admin only) ---
  describe("audit.view", () => {
    it("allows admin", () => expect(can(admin, "audit.view")).toBe(true));
    it("denies manager", () => expect(can(manager, "audit.view")).toBe(false));
    it("denies staff", () => expect(can(staff, "audit.view")).toBe(false));
  });

  // --- permissions.view (admin + manager, staff denied) ---
  describe("permissions.view", () => {
    it("allows admin", () => expect(can(admin, "permissions.view")).toBe(true));
    it("allows manager", () => expect(can(manager, "permissions.view")).toBe(true));
    it("denies staff", () => expect(can(staff, "permissions.view")).toBe(false));
  });

  // --- trash.purge (admin only) ---
  describe("trash.purge", () => {
    it("allows admin", () => expect(can(admin, "trash.purge")).toBe(true));
    it("denies manager", () => expect(can(manager, "trash.purge")).toBe(false));
    it("denies staff", () => expect(can(staff, "trash.purge")).toBe(false));
  });
});

// ─── requirePermission() ─────────────────────────────────────────────

describe("requirePermission", () => {
  it("does not throw when user has the permission", () => {
    expect(() => requirePermission(admin, "documents.create")).not.toThrow();
  });

  it("throws with status 401 for null user", () => {
    try {
      requirePermission(null, "documents.create");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.message).toBe("يجب تسجيل الدخول");
    }
  });

  it("throws with status 403 when user lacks the permission", () => {
    try {
      requirePermission(staff, "documents.delete");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toBe("ليس لديك صلاحية لهذه العملية");
    }
  });

  it("accepts a custom error message", () => {
    try {
      requirePermission(staff, "users.manage", "custom denied");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.message).toBe("custom denied");
      expect(err.status).toBe(403);
    }
  });

  it("accepts a custom message for null user", () => {
    try {
      requirePermission(null, "documents.create", "login required");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.message).toBe("login required");
      expect(err.status).toBe(401);
    }
  });

  it("does not throw for manager on manager-allowed permission", () => {
    expect(() => requirePermission(manager, "reports.view")).not.toThrow();
  });

  it("throws for staff on manager-only permission", () => {
    expect(() => requirePermission(staff, "reports.view")).toThrow();
  });
});

// ─── PERMISSIONS constant ─────────────────────────────────────────────

describe("PERMISSIONS", () => {
  it("is a non-empty object", () => {
    expect(typeof PERMISSIONS).toBe("object");
    expect(Object.keys(PERMISSIONS).length).toBeGreaterThan(0);
  });

  it("every value is a non-empty array of valid roles", () => {
    const validRoles = ["admin", "manager", "staff"];
    for (const [key, roles] of Object.entries(PERMISSIONS)) {
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
      for (const role of roles) {
        expect(validRoles).toContain(role);
      }
    }
  });

  it("has exactly 26 permission keys", () => {
    expect(Object.keys(PERMISSIONS)).toHaveLength(26);
  });

  it("all permission keys have Arabic labels", () => {
    for (const key of Object.keys(PERMISSIONS) as PermissionKey[]) {
      expect(PERMISSION_LABELS[key]).toBeDefined();
      expect(PERMISSION_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});

// ─── ROLE_LABELS ──────────────────────────────────────────────────────

describe("ROLE_LABELS", () => {
  it("has labels for all 3 roles", () => {
    expect(ROLE_LABELS["admin"]).toBe("مدير النظام");
    expect(ROLE_LABELS["manager"]).toBe("مشرف قسم");
    expect(ROLE_LABELS["staff"]).toBe("موظف");
  });
});
