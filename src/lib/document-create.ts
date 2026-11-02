import { unlink } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, documents, documentTags, documentVersions } from "@/db/schema";
import { resolveKey } from "@/lib/server";

/**
 * Remove storage files written for a request whose DB write failed. Missing
 * files are ignored — the goal is only that no orphan survives in storage/,
 * where it would be invisible in the UI yet still land in every backup zip.
 */
export async function removeStoredKeys(keys: Array<string | null | undefined>): Promise<void> {
  await Promise.all(
    [...new Set(keys.filter((k): k is string => !!k))].map((k) => unlink(resolveKey(k)).catch(() => {})),
  );
}

/**
 * Insert a new document, its version-1 row, its tags and its audit entry as
 * ONE atomic batch: a failure can no longer leave a document without its
 * first version. If the batch fails, the files the caller already wrote
 * (`writtenKeys`) are removed and the error is rethrown.
 *
 * `db.batch()` and not `db.transaction()`: libsql's `transaction()` hands the
 * shared connection to the transaction and opens a fresh connection for every
 * later query, silently dropping the per-connection PRAGMAs set in
 * `src/db/index.ts` (foreign_keys, busy_timeout). A batch runs BEGIN…COMMIT on
 * the shared connection.
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
  // The new id is not known inside a batch, so dependent rows look it up by
  // the freshly generated random storage key (newest match first).
  const newDocId = sql<number>`(SELECT id FROM documents WHERE storage_key = ${doc.storageKey} ORDER BY id DESC LIMIT 1)`;
  const tagIds = [...new Set(input.tagIds ?? [])];

  try {
    const [inserted] = await db.batch([
      db.insert(documents).values(doc).returning({ id: documents.id }),
      db.insert(documentVersions).values({
        documentId: newDocId,
        version: 1,
        storageKey: doc.storageKey,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        note: input.versionNote,
        uploadedById: doc.uploadedById,
        ...(input.versionCreatedAt ? { createdAt: input.versionCreatedAt } : {}),
      }),
      db.insert(auditLogs).values({
        userId: input.audit.userId,
        userName: input.audit.userName,
        action: input.audit.action,
        entityType: "document",
        entityId: newDocId,
        details: input.audit.details,
      }),
      ...(tagIds.length > 0
        ? [db.insert(documentTags).values(tagIds.map((tagId) => ({ documentId: newDocId, tagId })))]
        : []),
    ]);
    return inserted[0].id;
  } catch (err) {
    await removeStoredKeys(input.writtenKeys);
    throw err;
  }
}
