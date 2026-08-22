import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** Local standard fonts shipped with pdfjs-dist (silences font warnings). */
const STANDARD_FONT_URL =
  path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/") + "/";

/**
 * Extracts the embedded text layer of a PDF — the fast path for born-digital
 * PDFs (no OCR needed). Returns `null` when the PDF has little or no usable
 * text (scanned / image-only), so callers can fall back to OCR. Never throws.
 */
export async function extractPdfText(filePath: string): Promise<string | null> {
  try {
    const data = new Uint8Array(await readFile(filePath));
    const doc = await getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      standardFontDataUrl: STANDARD_FONT_URL,
    }).promise;

    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text +=
        content.items
          .map((it) => ("str" in it ? String((it as { str: string }).str) : ""))
          .join(" ") + "\n";
      page.cleanup();
    }
    await doc.destroy();

    const trimmed = text.trim();
    // Too little extracted text = scanned PDF → let OCR handle it.
    return trimmed.length >= 20 ? trimmed : null;
  } catch {
    return null;
  }
}