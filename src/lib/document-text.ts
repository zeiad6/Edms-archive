import { extname } from "node:path";
import { extractPdfText } from "@/lib/pdf-text";
import { runTesseractOcr } from "@/lib/tesseract";

/**
 * Smart document text extraction:
 * 1. PDF → try the embedded text layer first (fast, accurate for born-digital
 *    PDFs), falling back to Tesseract OCR for scanned PDFs.
 * 2. Any other file (images...) → local Tesseract OCR directly.
 */
export async function extractDocumentText(filePath: string): Promise<string> {
  if (extname(filePath).toLowerCase() === ".pdf") {
    const pdfText = await extractPdfText(filePath);
    if (pdfText) return pdfText;
  }
  return runTesseractOcr(filePath);
}