import { describe, it, expect } from "vitest";
import { canAccessDocument } from "@/lib/server";
import type { User, Document } from "@/db/schema";

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

const makeDoc = (overrides: Partial<Document> = {}): Document =>
  ({
    id: 10,
    title: "Test Doc",
    departmentId: 1,
    uploadedById: 1,
    confidential: 0,
    ...overrides,
  }) as unknown as Document;

const admin = makeUser({ id: 1, role: "admin", departmentId: 1 });
const manager = makeUser({ id: 2, role: "manager", departmentId: 2 });
const staff = makeUser({ id: 3, role: "staff", departmentId: 1 });

// ─── canAccessDocument() ──────────────────────────────────────────────

describe("canAccessDocument", () => {
  it("denies a null user", () => {
    expect(canAccessDocument(null, makeDoc())).toBe(false);
  });

  it("allows admin on any document, including confidential from another department", () => {
    const doc = makeDoc({ departmentId: 99, uploadedById: 99, confidential: 1 });
    expect(canAccessDocument(admin, doc)).toBe(true);
  });

  it("allows staff on their own uploaded document", () => {
    const doc = makeDoc({ departmentId: 2, uploadedById: staff.id });
    expect(canAccessDocument(staff, doc)).toBe(true);
  });

  it("allows staff on a non-confidential document in their department", () => {
    const doc = makeDoc({ departmentId: staff.departmentId, uploadedById: 99 });
    expect(canAccessDocument(staff, doc)).toBe(true);
  });

  it("denies staff on a document from another department they did not upload", () => {
    const doc = makeDoc({ departmentId: 2, uploadedById: 99 });
    expect(canAccessDocument(staff, doc)).toBe(false);
  });

  it("denies staff on any confidential document, even in their own department", () => {
    const doc = makeDoc({ departmentId: staff.departmentId, uploadedById: staff.id, confidential: 1 });
    expect(canAccessDocument(staff, doc)).toBe(false);
  });

  it("allows manager on a non-confidential document in their department", () => {
    const doc = makeDoc({ departmentId: manager.departmentId, uploadedById: 99 });
    expect(canAccessDocument(manager, doc)).toBe(true);
  });

  it("denies manager on a confidential document outside their department they did not upload", () => {
    const doc = makeDoc({ departmentId: 1, uploadedById: 99, confidential: 1 });
    expect(canAccessDocument(manager, doc)).toBe(false);
  });
});