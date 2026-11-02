// @vitest-environment node
// Regression: the next version number was computed from a `documents` row
// read before several awaits, so concurrent uploads to the same document all
// got the same number (three uploads -> versions 2, 2, 2).
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import type { User } from "@/db/schema";

const state = vi.hoisted(() => ({ user: null as User | null }));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return { ...actual, getCurrentUser: async () => state.user };
});

vi.mock("@/lib/thumbnails", () => ({
  createImageThumbnail: vi.fn(async () => null),
}));

const root = mkdtempSync(path.join(tmpdir(), "edms-versions-"));

beforeAll(() => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", `file:${path.join(root, "edms.db").replace(/\\/g, "/")}`);
  vi.stubEnv("EDMS_STORAGE_DIR", path.join(root, "storage"));
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("POST /api/documents/[id]/versions", () => {
  it("gives concurrent uploads distinct, consecutive version numbers", async () => {
    const { ensureSeeded } = await import("@/lib/seed");
    await ensureSeeded();
    const { db } = await import("@/db");
    const { users, documents, documentVersions } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { genKey, writeKey } = await import("@/lib/server");
    const { insertDocumentWithFirstVersion } = await import("@/lib/document-create");
    const { POST } = await import("../route");

    [state.user] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
    const userId = state.user!.id;
    const key = genKey("txt");
    await writeKey(key, Buffer.from("v1"));
    const docId = await insertDocumentWithFirstVersion({
      doc: { title: "عقد", storageKey: key, originalName: "a.txt", fileName: "a.txt", mimeType: "text/plain", fileSize: 2, uploadedById: userId },
      versionNote: "أولى",
      audit: { userId, userName: null, action: "document.upload", details: "x" },
      writtenKeys: [key],
    });

    const upload = (name: string) => {
      const form = new FormData();
      form.append("file", new File(["v"], name, { type: "text/plain" }));
      const req = new NextRequest(`http://localhost/api/documents/${docId}/versions`, { method: "POST", body: form });
      return POST(req, { params: Promise.resolve({ id: String(docId) }) });
    };
    const responses = await Promise.all([upload("b.txt"), upload("c.txt"), upload("d.txt")]);

    const bodies = await Promise.all(responses.map((r) => r.json()));
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(bodies.map((b) => b.version).sort()).toEqual([2, 3, 4]);

    const versions = await db
      .select({ v: documentVersions.version, note: documentVersions.note })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, docId));
    expect(versions.map((r) => r.v).sort()).toEqual([1, 2, 3, 4]);
    expect(versions.filter((r) => r.v > 1).every((r) => r.note === `الإصدار ${r.v}`)).toBe(true);

    const [doc] = await db.select({ version: documents.version }).from(documents).where(eq(documents.id, docId));
    expect(doc.version).toBe(4);
  });
});
