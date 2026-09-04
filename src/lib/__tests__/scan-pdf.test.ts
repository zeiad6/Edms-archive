import { describe, it, expect } from "vitest";
import { buildPdfFromJpegs, jpegInfo } from "@/lib/scan-pdf";

/** Minimal synthetic JPEG: SOI + SOF0 (w×h, `components`) + EOI. */
function fakeJpeg(width: number, height: number, components: 3 | 1): Uint8Array {
  // SOF0 length = 8 + 3×components (length field itself included).
  const len = 8 + 3 * components;
  const bytes = [
    0xff, 0xd8, // SOI
    0xff, 0xc0, (len >> 8) & 0xff, len & 0xff, 0x08, // SOF0, precision 8
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    components,
  ];
  for (let c = 1; c <= components; c++) bytes.push(c, 0x11, 0x00); // component specs
  bytes.push(0xff, 0xd9); // EOI
  return new Uint8Array(bytes);
}

describe("jpegInfo", () => {
  it("reads dimensions and RGB vs gray from the SOF segment", () => {
    expect(jpegInfo(fakeJpeg(800, 600, 3))).toEqual({ width: 800, height: 600, gray: false });
    expect(jpegInfo(fakeJpeg(800, 600, 1))).toEqual({ width: 800, height: 600, gray: true });
  });

  it("returns null for non-JPEG bytes", () => {
    expect(jpegInfo(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(jpegInfo(new Uint8Array([]))).toBeNull();
  });
});

describe("buildPdfFromJpegs", () => {
  it("throws on an empty page list", () => {
    expect(() => buildPdfFromJpegs([])).toThrow();
  });

  it("embeds one RGB page with a valid header and xref", () => {
    const jpg = fakeJpeg(100, 200, 3);
    const pdf = buildPdfFromJpegs([{ bytes: jpg, width: 100, height: 200, gray: false }]);
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 1");
    expect(text).toContain("/DCTDecode");
    expect(text).toContain("/DeviceRGB");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    // xref offsets must point at object headers.
    const startxref = Number(text.slice(text.lastIndexOf("startxref") + 9).split(/\s/)[1]);
    expect(Number.isInteger(startxref) && startxref > 0).toBe(true);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
  });

  it("embeds gray pages as DeviceGray and counts N pages", () => {
    const pages = [1, 2, 3].map(() => {
      const bytes = fakeJpeg(50, 50, 1);
      return { bytes, width: 50, height: 50, gray: true };
    });
    const pdf = buildPdfFromJpegs(pages);
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text).toContain("/Count 3");
    expect(text).toContain("/DeviceGray");
    expect(text).not.toContain("/DeviceRGB");
    // Three image XObjects, one per page.
    expect(text.split("/Subtype /Image").length - 1).toBe(3);
  });

  it("preserves raw JPEG bytes inside the file", () => {
    const jpg = fakeJpeg(10, 10, 3);
    const pdf = buildPdfFromJpegs([{ bytes: jpg, width: 10, height: 10, gray: false }]);
    // The exact JPEG byte run must appear verbatim (no re-encoding).
    outer: for (let i = 0; i + jpg.length <= pdf.length; i++) {
      for (let j = 0; j < jpg.length; j++) {
        if (pdf[i + j] !== jpg[j]) continue outer;
      }
      return; // found
    }
    throw new Error("JPEG bytes not found verbatim in the PDF");
  });
});
