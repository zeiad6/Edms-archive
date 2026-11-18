// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = mkdtempSync(path.join(tmpdir(), "edms-api-hardening-"));
const dataDir = path.join(root, "data");
const storageDir = path.join(root, "storage");
const dbFile = path.join(dataDir, "edms.db").replace(/\\/g, "/");

const authState = vi.hoisted(() => ({
  user: null as {
    id: number;
    name: string;
    role: "admin" | "manager" | "staff";
    departmentId: number | null;
    active: number;
  } | null,
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    getCurrentUser: async () => authState.user,
  };
});

beforeAll(async () => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", `file:${dbFile}`);
  vi.stubEnv("EDMS_DATA_DIR", dataDir);
  vi.stubEnv("EDMS_STORAGE_DIR", storageDir);
  const { ensureSeeded } = await import("@/lib/seed");
  await ensureSeeded();
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("Upload security: Magic Bytes & SVG DOMPurify sanitization", () => {
  it("validates genuine magic bytes and rejects disguised executables", async () => {
    const { validateMagicBytes } = await import("@/app/api/upload/route");

    expect(validateMagicBytes(Buffer.from("%PDF-1.7\n..."), "pdf")).toBe(true);
    expect(validateMagicBytes(Buffer.from("MZ\x90\x00\x03\x00\x00\x00"), "pdf")).toBe(false);

    expect(
      validateMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]), "png"),
    ).toBe(true);
    expect(validateMagicBytes(Buffer.from("<script>alert(1)</script>"), "png")).toBe(false);

    expect(validateMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "jpg")).toBe(true);
    expect(validateMagicBytes(Buffer.from("GIF89a..."), "gif")).toBe(true);
    expect(validateMagicBytes(Buffer.from("RIFF\x00\x00\x00\x00WEBP"), "webp")).toBe(true);
    expect(validateMagicBytes(Buffer.from("{\\rtf1\\ansi"), "rtf")).toBe(true);
    expect(validateMagicBytes(Buffer.from("plain text without null bytes"), "txt")).toBe(true);
    expect(validateMagicBytes(Buffer.from("binary\x00with\x00nulls"), "txt")).toBe(false);
  });

  it("sanitizes malicious scripts and event handlers from SVG uploads", async () => {
    const { sanitizeSvgBytes } = await import("@/app/api/upload/route");
    const dirtySvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert('xss')">
        <script> evil(); </script>
        <foreignObject><iframe></iframe></foreignObject>
        <rect width="100" height="100" onclick="steal()" />
      </svg>`,
      "utf8",
    );

    const cleaned = (await sanitizeSvgBytes(dirtySvg)).toString("utf8");
    expect(cleaned).toContain("<svg");
    expect(cleaned).not.toContain("<script");
    expect(cleaned).not.toContain("onload=");
    expect(cleaned).not.toContain("onclick=");
    expect(cleaned).not.toContain("<foreignObject");
  });
});

describe("Restore security: SQLite format 3 header check", () => {
  it("accepts valid SQLite 3 header and rejects arbitrary bytes", async () => {
    const { isValidSqliteFormat } = await import("@/app/api/restore/route");
    const validHeader = Buffer.concat([
      Buffer.from("SQLite format 3\0", "latin1"),
      Buffer.alloc(84),
    ]);
    expect(isValidSqliteFormat(validHeader)).toBe(true);
    expect(isValidSqliteFormat(Buffer.from("corrupted database file"))).toBe(false);
  });
});

describe("File streaming route: HTTP Range (206 Partial Content) & SVG sandbox headers", () => {
  it("serves 206 Partial Content with Content-Range for PDF Range requests and forces attachment+sandbox for SVG", async () => {
    const { db } = await import("@/db");
    const { documents, users } = await import("@/db/schema");
    const { GET: fileGET } = await import("@/app/api/documents/[id]/file/route");

    const [adminUser] = await db.select().from(users).limit(1);
    authState.user = {
      id: adminUser.id,
      name: adminUser.name,
      role: "admin",
      departmentId: adminUser.departmentId,
      active: 1,
    };

    const allDocs = await db.select().from(documents);
    const pdfDoc = allDocs.find((d) => d.mimeType === "application/pdf")!;
    const svgDoc = allDocs.find((d) => d.mimeType === "image/svg+xml")!;

    // 1. Range request on PDF -> 206 Partial Content
    const rangeReq = new NextRequest(`http://localhost/api/documents/${pdfDoc.id}/file`, {
      headers: { Range: "bytes=0-15" },
    });
    const rangeRes = await fileGET(rangeReq, { params: Promise.resolve({ id: String(pdfDoc.id) }) });
    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers.get("Accept-Ranges")).toBe("bytes");
    expect(rangeRes.headers.get("Content-Range")).toMatch(/^bytes 0-15\/\d+$/);
    expect(rangeRes.headers.get("Content-Length")).toBe("16");
    const partialBytes = Buffer.from(await rangeRes.arrayBuffer());
    expect(partialBytes.length).toBe(16);
    expect(partialBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // 2. SVG response enforces Content-Disposition: attachment and CSP sandbox
    const svgReq = new NextRequest(`http://localhost/api/documents/${svgDoc.id}/file`);
    const svgRes = await fileGET(svgReq, { params: Promise.resolve({ id: String(svgDoc.id) }) });
    expect(svgRes.status).toBe(200);
    expect(svgRes.headers.get("Content-Disposition")).toMatch(/^attachment;/);
    expect(svgRes.headers.get("Content-Security-Policy")).toContain("sandbox");
  });
});

describe("Spotlight FTS5 search & admin user switcher endpoint", () => {
  it("finds documents via SQLite FTS5 across title, contentText, and docNumber and restricts ?users=1 to admin", async () => {
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    const { GET: spotlightGET } = await import("@/app/api/search/spotlight/route");

    const [adminUser] = await db.select().from(users).limit(1);
    authState.user = {
      id: adminUser.id,
      name: adminUser.name,
      role: "admin",
      departmentId: adminUser.departmentId,
      active: 1,
    };

    // Search by contentText / title keyword via FTS5
    const searchReq = new NextRequest(
      `http://localhost/api/search/spotlight?q=${encodeURIComponent("الهيكل التنظيمي")}`,
    );
    const searchRes = await spotlightGET(searchReq);
    expect(searchRes.status).toBe(200);
    const searchBody = await searchRes.json();
    expect(searchBody.ok).toBe(true);
    expect(searchBody.results.length).toBeGreaterThan(0);
    expect(searchBody.results[0].title).toContain("الهيكل التنظيمي");

    // Admin can fetch ?users=1
    const adminUsersReq = new NextRequest("http://localhost/api/search/spotlight?users=1");
    const adminUsersRes = await spotlightGET(adminUsersReq);
    expect(adminUsersRes.status).toBe(200);
    const adminUsersBody = await adminUsersRes.json();
    expect(Array.isArray(adminUsersBody.users)).toBe(true);

    // Non-admin is denied ?users=1 with 403
    authState.user = {
      id: adminUser.id,
      name: "Staff User",
      role: "staff",
      departmentId: adminUser.departmentId,
      active: 1,
    };
    const staffUsersReq = new NextRequest("http://localhost/api/search/spotlight?users=1");
    const staffUsersRes = await spotlightGET(staffUsersReq);
    expect(staffUsersRes.status).toBe(403);
  });
});
