import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

// ───────────────────────────────────────────────────────────────────────────
// Route-level integration tests (permission gates, input validation, and the
// ZIP stream contract). The document query, auth helpers and audit logging
// are mocked; filesystem I/O runs against real temp files and the XLSX
// builder + archiver run for real.
// ───────────────────────────────────────────────────────────────────────────

const state = vi.hoisted(() => ({
  user: { id: 1, name: "مستخدم الاختبار" } as { id: number; name: string } | null,
  docs: [] as Array<Record<string, unknown>>,
  canAccess: true,
  logAudit: vi.fn(async () => {}),
}));

vi.mock("@/lib/server", () => ({
  getCurrentUser: async () => state.user,
  canAccessDocument: () => state.canAccess,
  // identity resolver (SYNC — the route calls resolveKey without await) —
  // tests use absolute temp paths as storage keys
  resolveKey: (key: string) => key,
  logAudit: state.logAudit,
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => state.docs,
      }),
    }),
  },
}));

import { POST } from "../route";

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

/** Minimal central-directory walk: entry names only (no inflating). */
function zipEntryNames(buf: Buffer): string[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd).toBeGreaterThanOrEqual(0);
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    expect(buf.readUInt32LE(offset)).toBe(0x02014b50);
    const nameLen = buf.readUInt16LE(offset + 28);
    names.push(buf.toString("utf8", offset + 46, offset + 46 + nameLen));
    offset += 46 + nameLen + buf.readUInt16LE(offset + 30) + buf.readUInt16LE(offset + 32);
  }
  return names;
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/documents/export-selected", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function docFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    title: "عقد توريد",
    docNumber: "REF-2026-001",
    docType: "عقد",
    status: "active",
    // null → the departments query branch is skipped entirely
    departmentId: null,
    deletedAt: null,
    docDate: new Date("2026-08-16"),
    createdAt: new Date("2026-08-16"),
    fileSize: 1234,
    thumbKey: null,
    storageKey: "",
    originalName: "عقد-توريد.pdf",
    fileName: "عقد-توريد.pdf",
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────────────────

describe("POST /api/documents/export-selected", () => {
  beforeEach(() => {
    state.user = { id: 1, name: "مستخدم الاختبار" };
    state.docs = [];
    state.canAccess = true;
    state.logAudit.mockClear();
  });

  it("rejects unauthenticated requests with 403", async () => {
    state.user = null;
    const res = await POST(makeRequest({ ids: [1] }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "غير مصرح" });
  });

  it("rejects a malformed JSON body with 400", async () => {
    const res = await POST(makeRequest("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "json مطلوب body" });
  });

  it("rejects missing or empty ids with 400", async () => {
    const noIds = await POST(makeRequest({}));
    expect(noIds.status).toBe(400);
    expect(await noIds.json()).toEqual({ error: "اختر مستنداً واحداً على الأقل" });

    const emptyIds = await POST(makeRequest({ ids: [] }));
    expect(emptyIds.status).toBe(400);
    expect(await emptyIds.json()).toEqual({ error: "اختر مستنداً واحداً على الأقل" });
  });

  it("rejects more than 50 ids with 400", async () => {
    const res = await POST(makeRequest({ ids: Array.from({ length: 51 }, (_, i) => i + 1) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "الحد الأقصى 50 مستنداً للتصدير" });
  });

  it("returns 404 when no documents match the ids", async () => {
    const res = await POST(makeRequest({ ids: [1] }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "لا توجد مستندات متطابقة" });
  });

  it("returns 403 when the user cannot access the matched documents", async () => {
    state.docs = [docFixture({ id: 1, storageKey: join(process.cwd(), "nope") })];
    state.canAccess = false;
    const res = await POST(makeRequest({ ids: [1] }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "ليس لديك صلاحية لتصدير هذه المستندات" });
  });

  it("skips soft-deleted documents via the permission gate", async () => {
    state.docs = [docFixture({ id: 1, deletedAt: new Date("2026-08-01") })];
    const res = await POST(makeRequest({ ids: [1] }));
    expect(res.status).toBe(403);
  });

  it("streams a ZIP with the manifest first, then the document files in order", async () => {
    const dir = mkdtempSync(join(tmpdir(), "edms-export-test-"));
    try {
      const fileA = join(dir, "orig-a.bin");
      const fileB = join(dir, "orig-b.bin");
      writeFileSync(fileA, Buffer.from("document A bytes"));
      writeFileSync(fileB, Buffer.from("document B bytes"));

      state.docs = [
        docFixture({ id: 1, storageKey: fileA, originalName: "عقد-توريد.pdf", fileName: "عقد-توريد.pdf" }),
        docFixture({
          id: 2,
          storageKey: fileB,
          title: "قرار إداري",
          originalName: "قرار إداري - 2026.pdf",
          fileName: "قرار إداري - 2026.pdf",
        }),
      ];

      const res = await POST(makeRequest({ ids: [1, 2] }));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/zip");
      expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="documents-export-/);

      const body = Buffer.from(await res.arrayBuffer());
      expect(body.subarray(0, 2).toString("ascii")).toBe("PK");
      // manifest is listed first, then documents in selection order
      expect(zipEntryNames(body)).toEqual([
        "report/كشف-المستندات.xlsx",
        "documents/عقد-توريد.pdf",
        "documents/قرار إداري - 2026.pdf",
      ]);

      expect(state.logAudit).toHaveBeenCalledTimes(1);
      expect(state.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: "document.export-selected",
        }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips document files that are missing or locked instead of failing the export", async () => {
    state.docs = [
      docFixture({ id: 1, storageKey: join(process.cwd(), "does-not-exist.bin") }),
    ];
    const res = await POST(makeRequest({ ids: [1] }));
    expect(res.status).toBe(200);
    const body = Buffer.from(await res.arrayBuffer());
    // manifest only — the missing file never made it into the archive
    expect(zipEntryNames(body)).toEqual(["report/كشف-المستندات.xlsx"]);
  });
});