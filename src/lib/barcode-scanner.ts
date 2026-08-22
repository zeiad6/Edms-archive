// Barcode scanning utilities using @zxing/library (ZXing / Zebra Crossing).
// Client-safe: only imports @zxing/library which works in the browser.
// Scans barcodes from data-URL images (exactly what the scanner client produces).

import { BrowserQRCodeReader, BrowserBarcodeReader, BarcodeFormat } from "@zxing/library";

export interface BarcodeResult {
  format: string;
  text: string;
  rawData?: string;
}

/**
 * Scan a single barcode from a data-URL image (PNG/SVG/JPEG).
 * Returns the first barcode found, or null if none detected.
 *
 * Uses BrowserBarcodeReader which supports all 1D/2D formats:
 * UPC-A, UPC-E, EAN-8, EAN-13, Code 39, Code 93, Code 128,
 * Codabar, ITF, QR Code, DataMatrix, Aztec, PDF417, etc.
 */
export async function scanBarcodeFromDataUrl(
  dataUrl: string,
): Promise<BarcodeResult | null> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;

  try {
    const reader = new BrowserBarcodeReader();
    const result = await reader.decodeFromImageUrl(dataUrl);

    if (!result) return null;

    return {
      format: formatToString(result.getBarcodeFormat()),
      text: result.getText(),
      rawData: result.getText(),
    };
  } catch {
    // No barcode found in the image — this is expected for non-barcoded scans
    return null;
  }
}

/**
 * Scan multiple barcodes from a data-URL image.
 * Returns all barcodes found, or an empty array if none detected.
 *
 * Note: decodeFromImageUrl returns the first barcode found. For multiple
 * barcodes, call this function on cropped regions or use a dedicated
 * multi-detection library. For most EDMS use cases, a single barcode per
 * document is sufficient.
 */
export async function scanBarcodesFromDataUrl(
  dataUrl: string,
): Promise<BarcodeResult[]> {
  const single = await scanBarcodeFromDataUrl(dataUrl);
  return single ? [single] : [];
}

/**
 * Scan a barcode from a video stream (live camera feed).
 * Returns a callback that fires for each detected barcode.
 *
 * Usage:
 *   const stop = await scanBarcodeFromCamera((barcode) => {
 *     // Handle detected barcode
 *   });
 *   // ... later
 *   stop();
 */
export async function scanBarcodeFromCamera(
  onDetected: (barcode: BarcodeResult) => void,
  videoElement?: HTMLVideoElement,
): Promise<() => void> {
  const reader = new BrowserQRCodeReader();

  if (videoElement) {
    // Use existing video element
    await reader.decodeFromVideoDevice(
      null,
      videoElement,
      (result, error) => {
        if (result) {
          onDetected({
            format: formatToString(result.getBarcodeFormat()),
            text: result.getText(),
          });
        }
        // Silently ignore "no barcode" errors — they're expected during scanning
      },
    );
    return () => reader.reset();
  } else {
    // Let the reader create its own video element
    await reader.decodeFromVideoDevice(
      null,
      null,
      (result, error) => {
        if (result) {
          onDetected({
            format: formatToString(result.getBarcodeFormat()),
            text: result.getText(),
          });
        }
        // Silently ignore "no barcode" errors — they're expected during scanning
      },
    );
    return () => reader.reset();
  }
}

/**
 * Check if a barcode value looks like a document reference number.
 * Used to auto-fill document metadata from scanned barcodes.
 */
export function parseDocumentRefFromBarcode(text: string): {
  docNumber?: string;
  isValid: boolean;
} {
  // Common document reference formats:
  // - Numeric: 6-12 digits
  // - Alphanumeric: prefix + digits (e.g., DOC-12345, INV-2024-001)
  // - UUID-like: 8-4-4-4-12

  const trimmed = text.trim();

  // Pure numeric reference (6-12 digits)
  if (/^\d{6,12}$/.test(trimmed)) {
    return { docNumber: trimmed, isValid: true };
  }

  // Alphanumeric with separator (e.g., DOC-12345, INV/2024/001)
  if (/^[A-Z]{2,6}[-/]\d{3,8}([-/]\d{2,4})?$/i.test(trimmed)) {
    return { docNumber: trimmed, isValid: true };
  }

  // UUID format
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed,
    )
  ) {
    return { docNumber: trimmed, isValid: true };
  }

  return { isValid: false };
}

// ── Internal helpers ──────────────────────────────────────────────────

function formatToString(format: BarcodeFormat): string {
  const map: Record<number, string> = {
    [BarcodeFormat.UPC_A]: "UPC-A",
    [BarcodeFormat.UPC_E]: "UPC-E",
    [BarcodeFormat.EAN_8]: "EAN-8",
    [BarcodeFormat.EAN_13]: "EAN-13",
    [BarcodeFormat.CODE_39]: "Code 39",
    [BarcodeFormat.CODE_93]: "Code 93",
    [BarcodeFormat.CODE_128]: "Code 128",
    [BarcodeFormat.CODABAR]: "Codabar",
    [BarcodeFormat.ITF]: "ITF",
    [BarcodeFormat.QR_CODE]: "QR Code",
    [BarcodeFormat.DATA_MATRIX]: "DataMatrix",
    [BarcodeFormat.AZTEC]: "Aztec",
    [BarcodeFormat.PDF_417]: "PDF417",
    [BarcodeFormat.MAXICODE]: "MaxiCode",
  };
  return map[format] || `Format-${format}`;
}
