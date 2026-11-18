import { unlink } from "node:fs/promises";
import { db, applyConnectionPragmas } from "@/db";
import { auditLogs, documents, documentTags, documentVersions } from "@/db/schema";
import { resolveKey } from "@/lib/server";
import { sql } from "drizzle-orm";

/**
 * Remove storage files written for a request whose DB write failed. Missing
 * files are ignored — the goal is only that no orphan survives in storage/,
 * where it would be invisible in the UI yet still land in every backup zip.
 */
export async function removeStoredKeys(keys: Array<string | null | undefined>): Promise<void> {
  await Promise.all(
    Array.from(new Set(keys.filter((k): k is string => !!k))).map((k) =>
      unlink(resolveKey(k)).catch(() => {}),
    ),
  );
}

/**
 * Insert a new document, its version-1 row, its tags and its audit entry inside
 * a single atomic `db.transaction(...)`. If any step fails, the transaction
 * rolls back and the files the caller already wrote (`writtenKeys`) are
 * unlinked so no orphan files accumulate on disk.
 *
 * `applyConnectionPragmas()` is called in `finally` so the shared libSQL
 * connection keeps `foreign_keys = ON` and `busy_timeout = 5000` after the
 * transaction closes.
 */
export async function insertDocumentWithFirstVersion(input: {
  doc: typeof documents.$inferInsert;
  versionNote: string;
  versionCreatedAt?: string;
  tagIds?: number[];
  audit: { userId: number; userName: string | null; action: string; details: string };
  writtenKeys: Array<string | null | undefined>;
}): Promise<number> {
  const { doc } = input;
  const tagIds = Array.from(
    new Set((input.tagIds ?? []).filter((n) => Number.isInteger(n) && n > 0)),
  );

  try {
    const newId = await db.transaction(async (tx) => {
      await tx.run(sql`PRAGMA foreign_keys = ON`);

      const [inserted] = await tx
        .insert(documents)
        .values(doc)
        .returning({ id: documents.id });
      const docId = inserted.id;

      await tx.insert(documentVersions).values({
        documentId: docId,
        version: 1,
        storageKey: doc.storageKey,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        note: input.versionNote,
        uploadedById: doc.uploadedById,
        ...(input.versionCreatedAt ? { createdAt: input.versionCreatedAt } : {}),
      });

      if (tagIds.length > 0) {
        await tx
          .insert(documentTags)
          .values(tagIds.map((tagId) => ({ documentId: docId, tagId })));
      }

      await tx.insert(auditLogs).values({
        userId: input.audit.userId,
        userName: input.audit.userName,
        action: input.audit.action,
        entityType: "document",
        entityId: docId,
        details: input.audit.details,
      });

      return docId;
    });

    return newId;
  } catch (err) {
    await removeStoredKeys(input.writtenKeys);
    throw err;
  } finally {
    await applyConnectionPragmas();
  }
}
