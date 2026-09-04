import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ───────────────────────────────────────────────────────────────────────────
// Critical-path guards WITHOUT a real database (all I/O mocked).
//
// Covers: api/backup (RBAC), api/restore (RBAC + validation), api/scan
// (auth), api/upload (RBAC + cross-department rule + 50MB limit +
// extension allowlist), documents/[id] access (canAccessDocument incl.
// confidential + cross-department), approvals (approvals.manage +
// assigned-approver rule).
// ───────────────────────────────────────────────────────────────────────────

const state = vi.hoisted(() => ({
  user: null as {
    id: number;
    name: string;
    role: string;
    departmentId: number | null;
  } | null,
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    getCurrentUser: async () => state.user,
    logAudit: vi.fn(async () => {}),
    writeKey: vi.fn(async () => {}),
    genKey: (ext: string) => `documents/2026/01/test.${ext}`,
  };
});

vi.mock("@/lib/tesseract", () => ({
  runTesseractOcr: vi.fn(async () => ""),
}));

vi.mock("@/lib/document-text", () => ({
  extractDocumentText: vi.fn(async () => ""),
}));

vi.mock("@/lib/thumbnails", () => ({
  createImageThumbnail: vi.fn(async () => null),
}));

import { GET as backupGET } from "./backup/route";
import { POST as restorePOST } from "./restore/route";
import { GET as scanGET } from "./scan/route";
import { POST as uploadPOST } from "./upload/route";
import { can, requirePermission } from "@/lib/permissions";
import { canAccessDocument } from "@/lib/server";
import { extFromName, mimeFromExt } from "@/lib/format";
import type { User, Document } from "@/db/schema";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const admin = { id: 1, name: "مدير", role: "admin", departmentId: 1 };
const manager = { id: 2, name: "مشرف", role: "manager", departmentId: 1 };
const staffA = { id: 3, name: "موظف أ", role: "staff", departmentId: 1 };
const staffB = { id: 4, name: "موظف ب", role: "staff", departmentId: 2 };

const makeUser = (o: Partial<User> = {}): User =>
  ({ id: 1, name: "u", email: "u@x.y", role: "staff", departmentId: 1, active: 1, ...o }) as unknown as User;
const makeDoc = (o: Partial<Document> = {}): Document =>
  ({ id: 10, title: "d", departmentId: 1, uploadedById: 1, confidential: 0, ...o }) as unknown as Document;

function uploadRequest(form: FormData): NextRequest {
  return new NextRequest("http://localhost/api/upload", { method: "POST", body: form });
}
// Fake upload request that bypasses multipart serialization (which would lose
// an overridden `size`): overrides request.formData() to return the stub file
// directly — the route only reads file.size/file.name before the gates tested.
function uploadRequestWithStub(
  fileStub: { name: string; size: number } | null,
  fields: Record<string, string> = {},
): NextRequest {
  const req = new NextRequest("http://localhost/api/upload", { method: "POST", body: new FormData() });
  const fileWithContent =
    fileStub === null
      ? null
      : { ...fileStub, arrayBuffer: async () => new ArrayBuffer(4), bytes: async () => new Uint8Array(4) };
  (req as unknown as { formData: () => Promise<{ get: (k: string) => unknown }> }).formData = async () => ({
    get: (k: string) => {
      if (k === "file") return fileWithContent;
      return fields[k] ?? null;
    },
  });
  return req;
}
// Sized Blob without allocating the bytes: the route reads `file.size` for
// the 50MB gate before ever touching the content.
function fakeFile(name: string, size: number): { name: string; size: number } {
  return { name, size };
}

// Approval assignee rule mirrors src/actions/approvals.ts:
// only the assigned approver may act — admin may act on any request.
function mayActOnApproval(user: { role: string; id: number }, req: { assignedToId: number }): boolean {
  if (user.role !== "admin" && req.assignedToId !== user.id) return false;
  return true;
}

beforeEach(() => {
  state.user = null;
});

// ─── /api/backup — admin-only RBAC gate ─────────────────────────────────────

describe("GET /api/backup", () => {
  it("rejects unauthenticated requests with 403", async () => {
    state.user = null;
    const res = await backupGET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "غير مصرح" });
  });

  it("rejects staff (no settings.manage) with 403", async () => {
    state.user = staffA;
    const res = await backupGET();
    expect(res.status).toBe(403);
  });

  it("rejects manager (no settings.manage) with 403", async () => {
    state.user = manager;
    const res = await backupGET();
    expect(res.status).toBe(403);
  });

  it("grants settings.manage to admin only (pure RBAC matrix)", () => {
    expect(can(makeUser({ role: "admin" }), "settings.manage")).toBe(true);
    expect(can(makeUser({ role: "manager" }), "settings.manage")).toBe(false);
    expect(can(makeUser({ role: "staff" }), "settings.manage")).toBe(false);
    expect(can(null, "settings.manage")).toBe(false);
  });
});

// ─── /api/restore — RBAC + ZIP validation ───────────────────────────────────

describe("POST /api/restore", () => {
  it("rejects unauthenticated requests with 403", async () => {
    state.user = null;
    const form = new FormData();
    const res = await restorePOST(new Request("http://localhost/api/restore", { method: "POST", body: form }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "غير مصرح" });
  });

  it("rejects staff with 403 even with a valid-looking body", async () => {
    state.user = staffA;
    const form = new FormData();
    const res = await restorePOST(new Request("http://localhost/api/restore", { method: "POST", body: form }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when no ZIP file is attached (admin)", async () => {
    state.user = admin;
    const form = new FormData();
    const res = await restorePOST(new Request("http://localhost/api/restore", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "لم يتم إرفاق ملف ZIP" });
  });

  it("returns 400 for a corrupt ZIP payload (admin)", async () => {
    state.user = admin;
    const form = new FormData();
    form.append("file", new Blob(["not-a-zip"], { type: "application/zip" }), "backup.zip");
    const res = await restorePOST(new Request("http://localhost/api/restore", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe("string");
  });
});

// ─── /api/scan — authentication gate ────────────────────────────────────────

describe("GET /api/scan", () => {
  it("rejects anonymous callers with 401", async () => {
    state.user = null;
    const res = await scanGET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "غير مصرح" });
  });
});

// ─── /api/upload — RBAC + 50MB limit + extension allowlist ──────────────────

describe("POST /api/upload", () => {
  it("rejects unauthenticated uploads with 401", async () => {
    state.user = null;
    const res = await uploadPOST(uploadRequest(new FormData()));
    expect(res.status).toBe(401);
  });

  it("rejects missing file with 400", async () => {
    state.user = staffA;
    const form = new FormData();
    form.append("title", "بدون ملف");
    const res = await uploadPOST(uploadRequest(form));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "الرجاء اختيار ملف وإدخال العنوان" });
  });

  it("rejects files over the 50MB limit with 413", async () => {
    state.user = staffA;
    const res = await uploadPOST(uploadRequestWithStub(fakeFile("big.pdf", 51 * 1024 * 1024), { title: "ملف ضخم" }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "حجم الملف يتجاوز الحد الأقصى 50 ميجابايت" });
  });

  it("accepts a file exactly at the 50MB boundary (no 413)", async () => {
    // `size > MAX` rejects but `size === MAX` must pass the size gate: the
    // invalid departmentId stops the request later with 400 (before any DB
    // insert), proving the 413 gate was passed.
    state.user = staffA;
    const res = await uploadPOST(
      uploadRequestWithStub(fakeFile("edge.pdf", 50 * 1024 * 1024), { departmentId: "not-a-number" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "قسم غير صالح" });
  });

  it("rejects unsupported extensions with 400", async () => {
    state.user = staffA;
    const res = await uploadPOST(uploadRequestWithStub(fakeFile("malware.exe", 1024), { title: "ملف مرفوض" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "نوع الملف غير مدعوم" });
  });

  it("derives MIME from the extension allowlist (pure util)", () => {
    expect(extFromName("Report.PDF")).toBe("pdf");
    expect(extFromName("no-extension")).toBe("");
    expect(mimeFromExt("pdf")).toBe("application/pdf");
    expect(mimeFromExt("png")).toBe("image/png");
    expect(mimeFromExt("exe")).toBe("application/octet-stream");
  });

  it("allows every role to attempt upload, denies anonymous (pure RBAC)", () => {
    for (const role of ["admin", "manager", "staff"] as const) {
      expect(can(makeUser({ role }), "documents.create")).toBe(true);
    }
    expect(can(null, "documents.create")).toBe(false);
  });

  it("restricts cross-department upload to admins (pure RBAC rule)", () => {
    // Mirrors the route: non-admins may only upload into their own department.
    const canManageAll = (u: User) => can(u, "documents.update_all");
    expect(canManageAll(makeUser({ role: "admin" }))).toBe(true);
    expect(canManageAll(makeUser({ role: "manager" }))).toBe(false);
    expect(canManageAll(makeUser({ role: "staff" }))).toBe(false);
  });
});

// ─── documents/[id] access — confidentiality + department scope ──────────────

describe("documents/[id] access (canAccessDocument)", () => {
  it("allows admin on confidential docs from another department", () => {
    expect(canAccessDocument(makeUser({ role: "admin" }), makeDoc({ departmentId: 99, confidential: 1 }))).toBe(true);
  });

  it("denies anonymous access", () => {
    expect(canAccessDocument(null, makeDoc())).toBe(false);
  });

  it("denies staff from another department (cross-department guard)", () => {
    const other = makeUser({ id: 9, role: "staff", departmentId: 2 });
    expect(canAccessDocument(other, makeDoc({ departmentId: 1, uploadedById: 1 }))).toBe(false);
  });

  it("denies staff on confidential docs even in their own department", () => {
    const u = makeUser({ id: 3, role: "staff", departmentId: 1 });
    expect(canAccessDocument(u, makeDoc({ departmentId: 1, uploadedById: 3, confidential: 1 }))).toBe(false);
  });

  it("allows the uploader on their own non-confidential doc", () => {
    const u = makeUser({ id: 3, role: "staff", departmentId: 2 });
    expect(canAccessDocument(u, makeDoc({ departmentId: 1, uploadedById: 3 }))).toBe(true);
  });

  it("denies managers on confidential docs outside their department", () => {
    const m = makeUser({ id: 2, role: "manager", departmentId: 2 });
    expect(canAccessDocument(m, makeDoc({ departmentId: 1, uploadedById: 99, confidential: 1 }))).toBe(false);
  });

  it("isolates staffB from staffA department docs", () => {
    const b = makeUser({ id: 4, role: "staff", departmentId: staffB.departmentId });
    expect(canAccessDocument(b, makeDoc({ departmentId: staffA.departmentId, uploadedById: 3 }))).toBe(false);
  });
});

// ─── approvals — manage permission + assigned-approver rule ──────────────────

describe("approvals guards", () => {
  it("allows admin/manager to manage approvals, denies staff", () => {
    expect(can(makeUser({ role: "admin" }), "approvals.manage")).toBe(true);
    expect(can(makeUser({ role: "manager" }), "approvals.manage")).toBe(true);
    expect(can(makeUser({ role: "staff" }), "approvals.manage")).toBe(false);
  });

  it("requirePermission throws 403 for staff on approvals.manage", () => {
    expect(() => requirePermission(makeUser({ role: "staff" }), "approvals.manage")).toThrow();
    expect(() => requirePermission(makeUser({ role: "manager" }), "approvals.manage")).not.toThrow();
  });

  it("only the assigned approver may act (non-admin)", () => {
    expect(mayActOnApproval({ role: "manager", id: 2 }, { assignedToId: 2 })).toBe(true);
    expect(mayActOnApproval({ role: "manager", id: 7 }, { assignedToId: 2 })).toBe(false);
  });

  it("admin may act on any request regardless of assignee", () => {
    expect(mayActOnApproval({ role: "admin", id: 1 }, { assignedToId: 99 })).toBe(true);
  });

  it("staff can never act (fails the manage gate first)", () => {
    expect(can(makeUser({ role: "staff" }), "approvals.manage")).toBe(false);
  });
});
