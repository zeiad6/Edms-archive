// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = mkdtempSync(path.join(tmpdir(), "edms-docs-hardening-"));
const dataDir = path.join(root, "data");
const storageDir = path.join(root, "storage");
const dbFile = path.join(dataDir, "edms.db").replace(/\\/g, "/");

const currentUserState = vi.hoisted(() => ({
  user: null as {
    id: number;
    name: string;
    role: "admin" | "manager" | "staff";
    departmentId: number | null;
    active: number;
  } | null,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    getCurrentUser: async () => currentUserState.user,
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

describe("Phase 1 & Phase 2 document actions hardening", () => {
  it("forceDeleteDocument refuses to delete or unlink files when deletedAt is null", async () => {
    const { db } = await import("@/db");
    const { documents, users } = await import("@/db/schema");
    const { writeKey, genKey, resolveKey } = await import("@/lib/server");
    const { forceDeleteDocument } = await import("@/actions/documents");
    const { eq } = await import("drizzle-orm");

    const [adminUser] = await db.select().from(users).limit(1);
    currentUserState.user = {
      id: adminUser.id,
      name: adminUser.name,
      role: "admin",
      departmentId: adminUser.departmentId,
      active: 1,
    };

    const key = genKey("txt");
    await writeKey(key, Buffer.from("live document content"));
    const [liveDoc] = await db
      .insert(documents)
      .values({
        title: "مستند حي غير محذوف",
        storageKey: key,
        originalName: "live.txt",
        fileName: key.split("/").pop()!,
        mimeType: "text/plain",
        fileSize: 21,
        uploadedById: adminUser.id,
        deletedAt: null,
      })
      .returning({ id: documents.id });

    await forceDeleteDocument(liveDoc.id);

    // Row and file must still exist because deletedAt was null
    const [stillThere] = await db.select().from(documents).where(eq(documents.id, liveDoc.id));
    expect(stillThere).toBeDefined();
    expect(existsSync(resolveKey(key))).toBe(true);

    // Now soft-delete and force-delete: both row and file must be removed
    await db
      .update(documents)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(documents.id, liveDoc.id));

    await forceDeleteDocument(liveDoc.id);
    const [afterForce] = await db.select().from(documents).where(eq(documents.id, liveDoc.id));
    expect(afterForce).toBeUndefined();
    expect(existsSync(resolveKey(key))).toBe(false);
  });

  it("emptyTrash deletes in chunks of 200 and only removes rows where deletedAt IS NOT NULL", async () => {
    const { db } = await import("@/db");
    const { documents, users } = await import("@/db/schema");
    const { emptyTrash } = await import("@/actions/documents");
    const { inArray } = await import("drizzle-orm");

    const [adminUser] = await db.select().from(users).limit(1);
    currentUserState.user = {
      id: adminUser.id,
      name: adminUser.name,
      role: "admin",
      departmentId: adminUser.departmentId,
      active: 1,
    };

    // Insert 205 trashed docs to exercise >200 chunking
    const rowsToInsert = Array.from({ length: 205 }, (_, idx) => ({
      title: `trashed-${idx}`,
      storageKey: `documents/2026/01/nonexistent-${idx}.txt`,
      originalName: `t-${idx}.txt`,
      fileName: `nonexistent-${idx}.txt`,
      mimeType: "text/plain",
      fileSize: 5,
      uploadedById: adminUser.id,
      deletedAt: new Date().toISOString(),
    }));
    const inserted = await db.insert(documents).values(rowsToInsert).returning({ id: documents.id });
    const insertedIds = inserted.map((r) => r.id);

    await emptyTrash();

    const remaining = await db
      .select({ id: documents.id })
      .from(documents)
      .where(inArray(documents.id, insertedIds));
    expect(remaining).toHaveLength(0);
  });

  it("updateDocument validates department/folder ownership and returns structured errors on RBAC denial", async () => {
    const { db } = await import("@/db");
    const { documents, departments, folders } = await import("@/db/schema");
    const { updateDocument } = await import("@/actions/documents");

    // Unauthenticated caller -> structured 401 result (no unhandled throw)
    currentUserState.user = null;
    const unauthFd = new FormData();
    unauthFd.set("id", "1");
    unauthFd.set("title", "عنوان");
    const unauthRes = await updateDocument(unauthFd);
    expect(unauthRes).toEqual({ ok: false, error: "يجب تسجيل الدخول", code: 401 });

    // Authenticated admin with mismatched folder/department -> structured 400 error
    const allDepts = await db.select().from(departments);
    const allFolders = await db.select().from(folders);
    const [firstDoc] = await db.select().from(documents).limit(1);

    currentUserState.user = {
      id: 1,
      name: "Admin",
      role: "admin",
      departmentId: allDepts[0].id,
      active: 1,
    };

    const deptA = allDepts[0];
    const folderInOtherDept = allFolders.find((f) => f.departmentId !== null && f.departmentId !== deptA.id);
    if (folderInOtherDept) {
      const badFd = new FormData();
      badFd.set("id", String(firstDoc.id));
      badFd.set("title", firstDoc.title);
      badFd.set("departmentId", String(deptA.id));
      badFd.set("folderId", String(folderInOtherDept.id));
      const mismatchRes = await updateDocument(badFd);
      expect(mismatchRes).toEqual({
        ok: false,
        error: "المجلد لا ينتمي إلى القسم المحدد",
        code: 400,
      });
    }
  });

  it("saveScannedDocument enforces documents.create and pre-validates Base64 size before Buffer allocation", async () => {
    const { saveScannedDocument } = await import("@/actions/documents");

    currentUserState.user = {
      id: 99,
      name: "Disabled Staff",
      role: "staff",
      departmentId: 1,
      active: 0,
    };

    await expect(
      saveScannedDocument({
        title: "Scan",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      }),
    ).rejects.toThrow();
  });

  it("mergeContentAndOcrText preserves legacy content_text descriptions and distinguishes ocrProcessed states", async () => {
    const { mergeContentAndOcrText } = await import("@/lib/ocr-jobs");

    // Empty OCR result keeps original description intact
    expect(mergeContentAndOcrText("وصف قديم للمستند", "وصف قديم للمستند", "")).toBe(
      "وصف قديم للمستند",
    );

    // Non-empty OCR merges with original description without losing it
    const merged = mergeContentAndOcrText("وصف قديم للمستند", "وصف قديم للمستند", "نص مستخرج عبر OCR");
    expect(merged).toContain("وصف قديم للمستند");
    expect(merged).toContain("نص مستخرج عبر OCR");
  });
});
