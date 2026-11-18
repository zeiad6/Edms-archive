import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { logAudit, resolveKey } from "@/lib/server";
import { extractDocumentText } from "@/lib/document-text";

type OcrActor = { id: number | null; name: string | null };

/**
 * Merge newly extracted OCR text with an existing description/contentText
 * so legacy documents that stored user descriptions in `content_text` never
 * lose their original text if OCR returns empty or fails.
 */
export function mergeContentAndOcrText(
  existingDescription: string | null | undefined,
  existingContentText: string | null | undefined,
  extractedOcrText: string,
): string | null {
  const cleanOcr = extractedOcrText.trim();
  const baseDesc = (existingDescription || existingContentText || "").trim();
  if (!cleanOcr) {
    return baseDesc || null;
  }
  if (!baseDesc || baseDesc === cleanOcr || cleanOcr.includes(baseDesc)) {
    return cleanOcr;
  }
  if (baseDesc.includes(cleanOcr)) {
    return baseDesc;
  }
  return `${baseDesc}\n\n${cleanOcr}`;
}

/**
 * Text extraction after upload — PDF text layer first, then local Tesseract OCR.
 *
 * `ocrProcessed` status codes:
 *   `0`  — unprocessed
 *   `1`  — processed with extracted text
 *   `2`  — processed without text (blank / pure image)
 *   `-1` — extraction failed
 */
export async function runUploadOcr(docId: number, storageKey: string, actor: OcrActor): Promise<void> {
  const [existing] = await db
    .select({
      description: documents.description,
      contentText: documents.contentText,
    })
    .from(documents)
    .where(eq(documents.id, docId))
    .limit(1);

  let text: string;
  try {
    text = await extractDocumentText(resolveKey(storageKey));
  } catch (err) {
    // Mark ocrProcessed = -1 (failed) while preserving existing content_text.
    await db
      .update(documents)
      .set({ ocrProcessed: -1 })
      .where(eq(documents.id, docId));

    await logAudit({
      userId: actor.id,
      userName: actor.name,
      action: "document.ocr_failed",
      entityType: "document",
      entityId: docId,
      details: "تعذّر استخراج النص تلقائياً بعد الرفع",
    });
    throw err;
  }

  const cleanText = (text || "").trim();
  const mergedContent = mergeContentAndOcrText(
    existing?.description,
    existing?.contentText,
    cleanText,
  );
  const ocrStatus = cleanText.length > 0 ? 1 : 2;

  await db
    .update(documents)
    .set({
      ocrText: cleanText || null,
      contentText: mergedContent,
      ocrProcessed: ocrStatus,
    })
    .where(eq(documents.id, docId));

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "document.ocr",
    entityType: "document",
    entityId: docId,
    details: cleanText
      ? "استخراج النص تلقائياً بعد الرفع"
      : "تمت معالجة المستند ضوئياً (صورة بلا نص مستخرج)",
  });
}

/**
 * Upload OCR is fire-and-forget, so a restart mid-extraction used to leave the
 * document at ocr_processed = 0 forever. On boot, re-run it for every upload
 * whose audit trail has no OCR outcome yet ("document.ocr" is also written
 * when extraction finds no text, so text-less scans are not retried).
 * Sequential on purpose: Tesseract is CPU-heavy and the server must stay
 * responsive while it catches up.
 */
export async function resumePendingOcr(): Promise<number> {
  const pending = await db.all<{ id: number; storage_key: string; uploaded_by_id: number; uploader_name: string | null }>(sql`
    SELECT d.id, d.storage_key, d.uploaded_by_id, u.name AS uploader_name
    FROM documents d
    LEFT JOIN users u ON u.id = d.uploaded_by_id
    WHERE d.ocr_processed = 0
      AND d.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM audit_logs a
                  WHERE a.entity_type = 'document' AND a.entity_id = d.id AND a.action = 'document.upload')
      AND NOT EXISTS (SELECT 1 FROM audit_logs a
                      WHERE a.entity_type = 'document' AND a.entity_id = d.id
                        AND a.action IN ('document.ocr', 'document.ocr_failed'))
    ORDER BY d.id`);

  for (const row of pending) {
    await runUploadOcr(row.id, row.storage_key, { id: row.uploaded_by_id, name: row.uploader_name }).catch((err) =>
      console.error(`[ocr] resume failed for document ${row.id}:`, err),
    );
  }
  return pending.length;
}
