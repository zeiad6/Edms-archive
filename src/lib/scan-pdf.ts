"use client";

/**
 * Offline multi-page PDF builder for the hardware multi-scan window.
 *
 * Scanned pages arrive as JPEG data-URLs (exactly what `/api/scan/hardware`
 * returns). Each page is embedded 1:1 as a `/DCTDecode` image XObject — no
 * re-encoding, no quality loss, no third-party dependency (the app is
 * offline-first, so jsPDF/pdf-lib are deliberately avoided).
 */

export interface PdfPageInput {
  bytes: Uint8Array;
  width: number;
  height: number;
  /** True for single-component (grayscale/BW) JPEGs → /DeviceGray. */
  gray: boolean;
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * Read dimensions + component count from a JPEG header (SOF segment).
 * Returns null when the bytes are not a parseable JPEG.
 */
export function jpegInfo(bytes: Uint8Array): { width: number; height: number; gray: boolean } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let pos = 2;
  while (pos + 4 < bytes.length) {
    if (bytes[pos] !== 0xff) return null;
    const marker = bytes[pos + 1];
    pos += 2;
    // Stand-alone markers carry no length field.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    const len = (bytes[pos] << 8) | bytes[pos + 1];
    if (len < 2 || pos + len > bytes.length) return null;
    if (SOF_MARKERS.has(marker)) {
      if (len < 8) return null;
      const height = (bytes[pos + 3] << 8) | bytes[pos + 4];
      const width = (bytes[pos + 5] << 8) | bytes[pos + 6];
      const components = bytes[pos + 7];
      if (!width || !height || !components) return null;
      return { width, height, gray: components === 1 };
    }
    pos += len;
  }
  return null;
}

/**
 * Assemble a multi-page PDF (one scanned page per PDF page) from raw JPEG
 * bytes. Pure function — no DOM, fully unit-testable.
 */
export function buildPdfFromJpegs(pages: PdfPageInput[]): Uint8Array {
  if (pages.length === 0) throw new Error("لا توجد صفحات لبناء ملف PDF");
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const push = (b: Uint8Array) => {
    chunks.push(b);
    length += b.length;
  };
  const pushStr = (s: string) => push(enc.encode(s));

  // Binary comment so viewers treat the file as binary (same convention as
  // the seed PDF builder in src/lib/seed.ts).
  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xf3, 0x0a]));

  // Object layout: 1 = Catalog, 2 = Pages, then per scanned page three
  // objects — content stream, page dict, image XObject (full-bleed Do).
  const offsets: number[] = [];

  const contentObjNum = (i: number) => 3 + i * 3;
  const pageObjNum2 = (i: number) => 4 + i * 3;
  const imgObjNum2 = (i: number) => 5 + i * 3;
  const objCount = 2 + pages.length * 3;
  const kids2 = pages.map((_, i) => `${pageObjNum2(i)} 0 R`).join(" ");

  const begin2 = (n: number) => {
    offsets[n] = length;
    pushStr(`${n} 0 obj\n`);
  };

  begin2(1);
  pushStr("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  begin2(2);
  pushStr(`<< /Type /Pages /Kids [${kids2}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((p, i) => {
    const scale = Math.min(595 / p.width, 842 / p.height);
    const pw = Math.max(1, Math.floor(p.width * scale));
    const ph = Math.max(1, Math.floor(p.height * scale));
    const content = `q\n${pw} 0 0 ${ph} 0 0 cm\n/Im0 Do\nQ\n`;
    const contentBytes = enc.encode(content);
    begin2(contentObjNum(i));
    pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
    push(contentBytes);
    pushStr("endstream\nendobj\n");

    begin2(pageObjNum2(i));
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${imgObjNum2(i)} 0 R >> >> /Contents ${contentObjNum(i)} 0 R >>\nendobj\n`,
    );

    begin2(imgObjNum2(i));
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /${p.gray ? "DeviceGray" : "DeviceRGB"} /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`,
    );
    push(p.bytes);
    pushStr("\nendstream\nendobj\n");
  });

  const xrefStart = length;
  let xref = `xref\n0 ${objCount + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= objCount; n++) {
    xref += `${String(offsets[n] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pushStr(xref);
  pushStr(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function base64Decode(dataUrl: string): Uint8Array {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("صيغة الصورة غير صحيحة");
  const bin = atob(m[2]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64Encode(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    img.src = dataUrl;
  });
}

/**
 * Normalize any image data-URL to raw JPEG bytes + dimensions. JPEG inputs
 * pass through untouched (dimensions from the JPEG header); other formats
 * are re-encoded via canvas at 92% quality.
 */
export async function dataUrlToJpegPage(dataUrl: string): Promise<PdfPageInput> {
  const isJpeg = dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg");
  if (isJpeg) {
    const bytes = base64Decode(dataUrl);
    const info = jpegInfo(bytes);
    if (info) return { bytes, ...info };
  }
  // PNG/WebP/unparseable JPEG → canvas re-encode (guaranteed RGB JPEG).
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) throw new Error("تعذر معالجة الصورة");
  ctx.drawImage(img, 0, 0);
  const jpegUrl = canvas.toDataURL("image/jpeg", 0.92);
  const bytes = base64Decode(jpegUrl);
  return { bytes, width: canvas.width, height: canvas.height, gray: false };
}

/** Convert scanned data-URLs (in order) to a PDF data-URL ready for saving. */
export async function scannedDataUrlsToPdfDataUrl(dataUrls: string[]): Promise<string> {
  const pages: PdfPageInput[] = [];
  for (const u of dataUrls) {
    pages.push(await dataUrlToJpegPage(u));
  }
  const pdf = buildPdfFromJpegs(pages);
  return `data:application/pdf;base64,${base64Encode(pdf)}`;
}

/** Re-encode a data-URL image to the requested raster format via canvas. */
export async function convertImageFormat(dataUrl: string, format: "jpg" | "png"): Promise<string> {
  if (format === "jpg" && dataUrl.startsWith("data:image/jpeg")) return dataUrl;
  if (format === "png" && dataUrl.startsWith("data:image/png")) return dataUrl;
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) throw new Error("تعذر معالجة الصورة");
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", 0.92);
}
