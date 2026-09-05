/** Shared types, constants, and helpers for the scanner UI. */

export interface Option {
  id: number;
  name: string;
}

export const DEFAULT_TITLE = "مستند ممسوح ضوئياً";
export const DEFAULT_DOC_TYPE = "صورة ضوئية";

export const INPUT_CLS =
  "w-full rounded-xl border border-border/80 bg-card px-3 py-2.5 text-sm text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05),0_1px_3px_rgb(0_0_0/0.07)] outline-none transition hover:border-primary/40 hover:shadow-[0_2px_6px_rgb(0_0_0/0.07)] focus:border-primary focus:bg-card focus:shadow-[0_2px_8px_rgb(0_0_0/0.08)] focus:ring-2 focus:ring-ring/30 focus-visible:ring-2 focus-visible:ring-ring/40 placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-60";

export interface SavePayload {
  title: string;
  docType: string;
  departmentId?: number;
  folderId?: number;
  docNumber: string;
  description: string;
  dataUrl: string;
}

/** A connected WIA scanner/printer (index is 1-based, stable per enumeration). */
export interface ScanDevice {
  index: number;
  deviceId: string;
  name: string;
}

/** Allowed DPI values for the multi-scan window (WIA HorizontalResolution). */
export const SCAN_DPIS = [75, 100, 150, 200, 300, 600] as const;
export type ScanDpi = (typeof SCAN_DPIS)[number];
export const DEFAULT_SCAN_DPI: ScanDpi = 300;

/** WIA ColorMode values: 0 = B/W, 1 = Grayscale, 2 = Color. */
export const SCAN_COLORS = [
  { id: "color", label: "ألوان", wia: 2 },
  { id: "gray", label: "تدرج رمادي", wia: 1 },
  { id: "bw", label: "أسود وأبيض", wia: 0 },
] as const;
export type ScanColorId = (typeof SCAN_COLORS)[number]["id"];
export const DEFAULT_SCAN_COLOR: ScanColorId = "color";

/** Save formats offered by the multi-scan window. */
export const SCAN_FORMATS = [
  { id: "pdf", label: "PDF (ملف واحد لكل الصفحات)" },
  { id: "jpg", label: "JPEG (مستند لكل صفحة)" },
  { id: "png", label: "PNG (مستند لكل صفحة)" },
] as const;
export type ScanFormatId = (typeof SCAN_FORMATS)[number]["id"];
export const DEFAULT_SCAN_FORMAT: ScanFormatId = "pdf";

/**
 * Parse `DEVICE|<index>|<deviceId>|<name>` lines emitted by
 * `scripts/scan-wia.ps1 -ListOnly` into device records. Ignores any other
 * stdout noise (warnings, blank lines) so parsing never throws.
 */
export function parseWiaDeviceList(stdout: string): ScanDevice[] {
  const devices: ScanDevice[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("DEVICE|")) continue;
    const parts = line.split("|");
    if (parts.length < 4) continue;
    const index = Number(parts[1]);
    const deviceId = parts[2].trim();
    const name = parts.slice(3).join("|").trim();
    if (!Number.isInteger(index) || index < 1 || !deviceId || !name) continue;
    devices.push({ index, deviceId, name });
  }
  return devices.sort((a, b) => a.index - b.index);
}

/** Reads the save form fields into the payload expected by saveScannedDocument. */
export function buildSavePayload(fd: FormData, dataUrl: string): SavePayload {
  return {
    title: String(fd.get("title") || DEFAULT_TITLE),
    docType: String(fd.get("docType") || DEFAULT_DOC_TYPE),
    departmentId: fd.get("departmentId") ? Number(fd.get("departmentId")) : undefined,
    folderId: fd.get("folderId") ? Number(fd.get("folderId")) : undefined,
    docNumber: String(fd.get("docNumber") || ""),
    description: String(fd.get("description") || ""),
    dataUrl,
  };
}