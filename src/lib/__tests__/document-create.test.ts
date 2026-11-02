// @vitest-environment node
// Regression: creating a document used to be four separate writes (document,
// version 1, tags, audit) with no rollback, and the upload route's promised
// "drop the file if the insert fails" cleanup was never implemented. A failure
// part-way left a document without its first version plus orphan files in
// storage/. Interrupted upload OCR was also never retried after a restart.
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("@/lib/document-text", () => ({
  extractDocumentText: vi.fn(async () => "نص مستخرج"),
}));

const root = mkdtempSync(path.join(tmpdir(), "edms-doc-create-"));

beforeAll(() => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", `file:${path.join(root, "edms.db").replace(/\\/g, "/")}`);
  vi.stubEnv("EDMS_STORAGE_DIR", path.join(root, "storage"));
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

async function setup() {
  const { ensureSeeded } = await import("@/lib/seed");
  await ensureSeeded();
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const server = await import("@/lib/server");
  const { insertDocumentWithFirstVersion } = await import("@/lib/document-create");
  const { eq, sql } = await import("drizzle-orm");
  const [admin] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  return { db, schema, server, insertDocumentWithFirstVersion, eq, sql, userId: admin.id };
}

function docValues(storageKey: string, userId: number) {
  return {
    title: "اختبار",
    storageKey,
    originalName: "a.txt",
    fileName: storageKey.split("/").pop()!,
    mimeType: "text/plain",
    fileSize: 3,
    uploadedById: userId,
  };
}

describe("insertDocumentWithFirstVersion", () => {
  it("writes document, version 1, tags and audit together", async () => {
    const { db, schema, server, insertDocumentWithFirstVersion, eq, userId } = await setup();
    const [tag] = await db.insert(schema.tags).values({ name: `وسم-${Date.now()}` }).returning({ id: schema.tags.id });
    const key = server.genKey("txt");
    await server.writeKey(key, Buffer.from("abc"));

    const id = await insertDocumentWithFirstVersion({
      doc: docValues(key, userId),
      versionNote: "أولى",
      tagIds: [tag.id, tag.id],
      audit: { userId, userName: "مدير", action: "document.upload", details: "x" },
      writtenKeys: [key],
    });

    const versions = await db.select().from(schema.documentVersions).where(eq(schema.documentVersions.documentId, id));
    expect(versions.map((v) => v.version)).toEqual([1]);
    const docTags = await db.select().from(schema.documentTags).where(eq(schema.documentTags.documentId, id));
    expect(docTags.map((t) => t.tagId)).toEqual([tag.id]);
    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, id));
    expect(audits.some((a) => a.action === "document.upload" && a.entityType === "document")).toBe(true);
    expect(existsSync(server.resolveKey(key))).toBe(true);
  });

  it("rolls back every row and removes the written files when one insert fails", async () => {
    const { db, schema, server, insertDocumentWithFirstVersion, eq, sql, userId } = await setup();
    const key = server.genKey("txt");
    const thumb = key.replace(/^documents\//, "thumbnails/");
    await server.writeKey(key, Buffer.from("abc"));
    await server.writeKey(thumb, Buffer.from("t"));

    // Tag 999999 does not exist: the tags insert (last in the batch) violates
    // its foreign key after the document and version rows were written.
    await expect(
      insertDocumentWithFirstVersion({
        doc: docValues(key, userId),
        versionNote: "أولى",
        tagIds: [999999],
        audit: { userId, userName: "مدير", action: "document.upload", details: "x" },
        writtenKeys: [key, thumb],
      }),
    ).rejects.toThrow();

    expect(await db.select().from(schema.documents).where(eq(schema.documents.storageKey, key))).toEqual([]);
    expect(await db.select().from(schema.documentVersions).where(eq(schema.documentVersions.storageKey, key))).toEqual([]);
    expect(existsSync(server.resolveKey(key))).toBe(false);
    expect(existsSync(server.resolveKey(thumb))).toBe(false);

    // The batch ran on the shared connection, so its PRAGMAs are still in force.
    const [fk] = await db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
    const [busy] = await db.all<{ timeout: number }>(sql`PRAGMA busy_timeout`);
    expect(fk.foreign_keys).toBe(1);
    expect(busy.timeout).toBe(5000);
  });
});

describe("resumePendingOcr", () => {
  it("re-runs OCR only for uploads with no recorded OCR outcome", async () => {
    const { db, schema, server, insertDocumentWithFirstVersion, eq, userId } = await setup();
    const { resumePendingOcr } = await import("@/lib/ocr-jobs");
    const upload = async (withOcrAudit: boolean) => {
      const key = server.genKey("txt");
      await server.writeKey(key, Buffer.from("abc"));
      const id = await insertDocumentWithFirstVersion({
        doc: docValues(key, userId),
        versionNote: "أولى",
        audit: { userId, userName: "مدير", action: "document.upload", details: "x" },
        writtenKeys: [key],
      });
      if (withOcrAudit) {
        await server.logAudit({ userId, action: "document.ocr", entityType: "document", entityId: id });
      }
      return id;
    };
    const interrupted = await upload(false);
    const textless = await upload(true);

    await resumePendingOcr();

    const ocrOf = async (id: number) =>
      (await db.select({ o: schema.documents.ocrProcessed }).from(schema.documents).where(eq(schema.documents.id, id)))[0].o;
    expect(await ocrOf(interrupted)).toBe(1);
    expect(await ocrOf(textless)).toBe(0);
    // Now recorded, so a second boot does not process it again.
    const { extractDocumentText } = await import("@/lib/document-text");
    vi.mocked(extractDocumentText).mockClear();
    await resumePendingOcr();
    expect(extractDocumentText).not.toHaveBeenCalled();
  });
});
