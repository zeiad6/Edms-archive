/**
 * Zero-dependency XLSX (OOXML) builder for the export manifest.
 *
 * SpreadsheetML (XML Spreadsheet 2003) cannot embed images inside cells
 * reliably, so the workbook is produced as a real `.xlsx`: a ZIP container of
 * hand-written OOXML parts ([Content_Types].xml, root/package rels,
 * workbook.xml, styles.xml, two worksheets + their drawings + shared media).
 * No spreadsheet library is used — every part is generated here, and the
 * container is zipped with the already-shipped `archiver` dependency (static
 * named import only — same constraint as route.ts; `createRequire` breaks in
 * packaged builds).
 *
 * Workbook layout (3 sheets, deterministic):
 *  - sheet1 «كشف المستندات» — the tabular manifest (RTL): dark-emerald merged
 *    title row with gold text, emerald header, emerald-tint alternating rows,
 *    frozen header pane + AutoFilter, a preview column (64px thumbnails with
 *    a thin border), the «الملف» hyperlink column showing the raw archive
 *    file name, a totals footer row (COUNT/SUM) and landscape fit-to-page
 *    print setup.
 *  - sheet2 «صور المستندات» — a photo gallery grid (LTR): 4 columns × N rows
 *    of ~150×110px preview images (bordered), each with a caption cell below
 *    it (title + reference) that hyperlinks to the file; the image itself
 *    also carries the hyperlink via `a:hlinkClick`.
 *  - sheet3 «الغلاف» — a cover sheet (RTL): EDMS wordmark, generation date,
 *    document count, total size, and summary tables by status/department.
 *
 * Hyperlinks are OOXML *external* relationships (`TargetMode="External"`)
 * whose targets are the **raw, XML-escaped file names** — NOT percent-encoded.
 * Excel resolves a relative external target as a literal sibling-file path and
 * does NOT percent-decode it (URI decoding is applied only to http(s)
 * targets), so an encoded target like `%D9%A0%D9%A1...svg` makes Excel look
 * for a file that is literally named `%D9%A0...` → "cannot open the specified
 * file". After the user extracts the archive every link resolves relative to
 * the manifest in `report/` (i.e. `../documents/<file>`). The only exception
 * is `#` (see
 * {@link hyperlinkTarget}).
 *
 * Every builder here is pure (no I/O, no timestamps). The route reads the
 * thumbnails from storage and passes the buffers in, so the output is fully
 * deterministic: same rows + options → same parts.
 */
import { deflateSync } from "node:zlib";
import { PassThrough } from "node:stream";
// archiver v8 is ESM with named class exports. Static named import (NOT
// createRequire): createRequire compiles to a synchronous __turbopack_require__
// that only resolves modules in the same chunk — in packaged builds it throws
// "p is not a function". Static imports become async chunk loads and work.
import { ZipArchive } from "archiver";

// ───────────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────────

export type XlsxImageExt = "jpg" | "png" | "gif" | "bmp";

/** An image embedded into a worksheet (Excel-renderable raster only). */
export interface XlsxPreview {
  data: Buffer;
  ext: XlsxImageExt;
  contentType: string;
}

export interface XlsxDocRow {
  index: number;
  title: string;
  docNumber: string | null;
  docType: string | null;
  status: string;
  departmentName: string | null;
  date: string;
  fileSize: number;
  /** Bare file name inside `documents/` — hyperlink target is `${linkBasePath}${entryName}`. */
  entryName: string;
  /** Preview image, or null → generated placeholder icon. */
  preview: XlsxPreview | null;
}

export interface XlsxOptions {
  /** Merged title-row text (row 1) of the manifest sheet. Defaults to "كشف المستندات". */
  title?: string;
  /** Manifest tab name. Defaults to "كشف المستندات". */
  sheetName?: string;
  /** Cover sheet tab name. Defaults to "الغلاف". */
  coverSheetName?: string;
  /** Generation date label shown on the cover (defaults to title suffix or ""). */
  generatedAt?: string;
  /**
   * Relative prefix from the manifest file to the documents folder
   * (defaults to `../documents/` — manifest in `report/`). Every sheet,
   * gallery and `hlinkClick` target is `${linkBasePath}${entryName}`.
   */
  linkBasePath?: string;
}

export interface XlsxPart {
  name: string;
  data: Buffer;
}

// ───────────────────────────────────────────────────────────────────────────
// XML helpers
// ───────────────────────────────────────────────────────────────────────────

const XML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escape user-controlled text so it can never break out of the XML document.
 * Also strips control characters that are illegal in XML 1.0 (U+0000-U+0008,
 * U+000B, U+000C, U+000E-U+001F); tab, LF and CR are legal and preserved, so
 * gallery captions keep their newline (with xml:space="preserve" + wrapText).
 */
export function escapeXml(value: string): string {
  const cleaned = value
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join("");
  return cleaned.replace(/[&<>"']/g, (ch) => XML_ESCAPE[ch]);
}

/**
 * Build the hyperlink Target for a ZIP entry name, resolved relative to the
 * manifest location after extraction (`basePath` — e.g. `../documents/` when
 * the manifest lives in `report/` and the files in `documents/`).
 *
 * THE BUG THIS FIXES: the target used to be `encodeURIComponent(name)`.
 * Excel does NOT percent-decode relative external targets — it only URI-decodes
 * http(s) targets. For a local file link it resolves the Target as a literal
 * path relative to the workbook folder, so `%D9%A0%D9%A1...svg` was looked up
 * as a file literally named `%D9%A0%D9%A1...svg` → "cannot open the specified
 * file". Therefore the target MUST be the raw Unicode file name.
 *
 * Minimal escaping (documented choices):
 *  - XML metacharacters (`& < > " '`) are escaped by the caller via
 *    `escapeXml` — mandatory for any XML attribute. (`&` can legitimately
 *    appear in entry names: route.ts only strips `:*?"<>|`.)
 *  - `#` → `%23`, ONLY when present. A raw `#` would be parsed as the start of
 *    a URI fragment, truncating the path ("file#x.pdf" → path "file") and
 *    breaking the link; `%23` keeps the path intact. Note `?` (the other URI
 *    delimiter) can never appear — the route sanitizer replaces it with `_`.
 *  - Spaces, `%`, Arabic and every other character stay RAW. Any percent
 *    escape (`%20`, `%25`, UTF-8 sequences) would be looked up literally by
 *    Excel and break the link — raw is the only form that resolves to the
 *    actual archive entry.
 */
export const DOCUMENTS_DIR = "documents";
export const REPORT_DIR = "report";
export const MANIFEST_FILE_NAME = "كشف-المستندات.xlsx";
/**
 * قرار البنية: الكشف في `report/` والمستندات في `documents/` (مجلدا ASCII
 * لتفادي مشاكل الترميز مع إبقاء اسم الكشف عربيًا) — كل الروابط نسبية من
 * موقع الكشف: `../documents/<file>`.
 */
export const MANIFEST_ZIP_PATH = `${REPORT_DIR}/${MANIFEST_FILE_NAME}`;
export const DEFAULT_LINK_BASE_PATH = `../${DOCUMENTS_DIR}/`;

export function hyperlinkTarget(name: string, basePath = ""): string {
  const target = basePath ? `${basePath}${name}` : name;
  return target.includes("#") ? target.replaceAll("#", "%23") : target;
}

/** 0-based column index → Excel column letter (bijective base-26: 0→A, 25→Z, 26→AA). */
export function colLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Cell reference for a 0-based column and a 1-based row (e.g. (8, 3) → "I3"). */
export function cellRef(col: number, row: number): string {
  return `${colLetter(col)}${row}`;
}

function inlineStringCell(ref: string, style: number, text: string): string {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function numberCell(ref: string, style: number, value: number): string {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function emptyCell(ref: string, style: number): string {
  return `<c r="${ref}" s="${style}"/>`;
}

// ───────────────────────────────────────────────────────────────────────────
// Sheet layout
// ───────────────────────────────────────────────────────────────────────────

const SHEET_NAME = "كشف المستندات";
const DEFAULT_TITLE = "كشف المستندات";
const COVER_TITLE = "الغلاف";

const HEADERS = [
  "م",
  "العنوان",
  "الرقم المرجعي",
  "النوع",
  "الحالة",
  "القسم",
  "التاريخ",
  "الحجم",
  "الملف",
  "المعاينة",
] as const;

// Title column widened (42 → 48) so long Arabic titles stay readable; the
// preview column is ~96px (≈90px + padding) so thumbnails don't crowd the
// neighbours. The «الملف» column keeps the raw file name visible AND carries
// the external hyperlink (decision: the file-name cell IS the hyperlink
// display column — a separate «رابط المستند» column would duplicate the same
// text; users see exactly what they are clicking, styled blue+underline).
const COL_WIDTHS = [5, 48, 20, 16, 16, 22, 18, 15, 34, 13] as const;
const COLUMN_COUNT = HEADERS.length; // 10 → A..J
const HYPERLINK_COL = 8; // I — «الملف» (opens the sibling file)
const PREVIEW_COL = 9; // J — «المعاينة» (embedded image)

// Manifest preview column: 64×64px thumbnails (the placeholder PNG is natively
// 64×64, so raster previews and placeholders share the same presentation),
// 52pt rows (≈69px → 2.7px top/bottom margin), thin slate border.
const PREVIEW_PX = 64;
const PREVIEW_EMU = Math.round((PREVIEW_PX / 96) * 914400); // 64px @ 96dpi = 609600
const ROW_HEIGHT_PT = 52; // ≈69px — 64px image + breathing room
const HEADER_ROW_PT = 26;
const TITLE_ROW_PT = 32;
// Column 13 chars ≈ 96px: (96 − 64) / 2 = 16px left/right centering margin.
const PREVIEW_ROW_OFFSET_EMU = Math.round((((ROW_HEIGHT_PT * 96) / 72 - PREVIEW_PX) / 2) * 9525);
const PREVIEW_COL_OFFSET_EMU = Math.round(((13 * 7 + 5 - PREVIEW_PX) / 2) * 9525);

// Gallery sheet «صور المستندات»: deterministic row-major grid, 4 columns.
// Layout decision — the gallery is LTR (no rightToLeft) even though the app
// is RTL: photo grids scan left-to-right regardless of locale, and in an RTL
// sheet Excel reverses the visual order of the columns (A renders rightmost),
// which would make the deterministic fill (doc 1 in column A) appear at the
// right edge. LTR keeps anchor column == visual position; Arabic text inside
// cells is still laid out correctly per-run by Excel's bidi engine.
export const GALLERY_COLS = 4; // A..D
const GALLERY_TITLE = "صور المستندات";
const GALLERY_COL_WIDTH = 24; // ≈173px
const GALLERY_IMG_W_PX = 150;
const GALLERY_IMG_H_PX = 110;
const GALLERY_IMG_W_EMU = Math.round((GALLERY_IMG_W_PX / 96) * 914400); // 150px = 1428750
const GALLERY_IMG_H_EMU = Math.round((GALLERY_IMG_H_PX / 96) * 914400); // 110px = 1047750
const GALLERY_IMG_ROW_PT = 98; // ≈130px — 110px image + 10px margins
const GALLERY_CAPTION_ROW_PT = 32; // two-line caption (title + reference)
const GALLERY_ROW_OFFSET_EMU = Math.round((((GALLERY_IMG_ROW_PT * 96) / 72 - GALLERY_IMG_H_PX) / 2) * 9525);
const GALLERY_COL_OFFSET_EMU = Math.round(((GALLERY_COL_WIDTH * 7 + 5 - GALLERY_IMG_W_PX) / 2) * 9525);
const BORDER_EMU = 12700; // 1pt thin line

// `to` markers for the twoCellAnchor drawings below (ECMA-376 CT_TwoCellAnchor
// requires from + to; with editAs="oneCell" Excel keeps the spPr/xfrm size and
// moves the picture with its cell). Each image fits entirely inside its anchor
// cell (offsets verified against column widths / row heights above), so `to`
// reuses the `from` cell with start-offset + size:
//  - manifest: colOff 152400+609600=762000 (< 914400 col), rowOff 25400+609600=635000 (< 660400 row)
//  - gallery: colOff 109538+1428750=1538288 (< 1647750 col), rowOff 98425+1047750=1146175 (< 1244600 row)
const PREVIEW_TO_COL_OFF_EMU = PREVIEW_COL_OFFSET_EMU + PREVIEW_EMU; // 762000
const PREVIEW_TO_ROW_OFF_EMU = PREVIEW_ROW_OFFSET_EMU + PREVIEW_EMU; // 635000
const GALLERY_TO_COL_OFF_EMU = GALLERY_COL_OFFSET_EMU + GALLERY_IMG_W_EMU; // 1538288
const GALLERY_TO_ROW_OFF_EMU = GALLERY_ROW_OFFSET_EMU + GALLERY_IMG_H_EMU; // 1146175

/**
 * Grid geometry for gallery doc index k (0-based):
 * - column k % 4, block floor(k / 4)
 * - image anchored at worksheet row 2 + 2·block (0-based anchor row 1 + 2·block)
 * - caption cell at row 3 + 2·block
 */
function galleryImageRow(k: number): number {
  return 2 + 2 * Math.floor(k / GALLERY_COLS);
}
function galleryCaptionRow(k: number): number {
  return galleryImageRow(k) + 1;
}

// ───────────────────────────────────────────────────────────────────────────
// Placeholder icon — a hand-rolled PNG (zero dependencies)
// ───────────────────────────────────────────────────────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let crcTable: Uint32Array | null = null;

function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Deterministic 64×64 RGBA PNG used as the thumbnail for documents without a
 * raster preview (PDF, DOCX, SVG, …): an indigo document glyph with a folded
 * corner and three text lines. Pure pixel math + node:zlib. A single shared
 * part of this image is referenced from every anchor that needs it (both the
 * manifest preview column and the gallery grid).
 */
export function buildPlaceholderPng(size = 64): Buffer {
  const half = (size - 1) / 2;
  const radius = Math.max(4, Math.round(size * 0.16));
  const base = [6, 95, 70]; // #065F46 emerald-800
  const fold = [4, 78, 56]; // #044E38 — folded corner
  const line = [252, 211, 77]; // #FCD34D gold lines on emerald
  const bars: Array<[number, number]> = [
    [size * 0.52, size * 0.585],
    [size * 0.64, size * 0.705],
    [size * 0.76, size * 0.825],
  ];

  const rows: Buffer[] = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const o = 1 + x * 4;
      const dx = Math.abs(x - half);
      const dy = Math.abs(y - half);
      const inRect =
        (dx <= half - radius && dy <= half - radius) ||
        (dx > half - radius &&
          dy > half - radius &&
          (dx - (half - radius)) ** 2 + (dy - (half - radius)) ** 2 <= radius ** 2);
      if (!inRect) {
        row[o] = 0;
        row[o + 1] = 0;
        row[o + 2] = 0;
        row[o + 3] = 0;
        continue;
      }
      // folded corner triangle (top-right): vertices (s-1,0) (s-1,2r) (s-1-2r,0)
      const inFold = x <= size - 1 && y >= 0 && y <= x - (size - 1) + 2 * radius;
      const inLine = bars.some(
        ([y0, y1]) => y >= y0 && y <= y1 && x >= size * 0.3 && x <= size * 0.7,
      );
      const rgb = inFold ? fold : base;
      row[o] = rgb[0];
      row[o + 1] = rgb[1];
      row[o + 2] = rgb[2];
      row[o + 3] = inLine ? 235 : 255;
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ───────────────────────────────────────────────────────────────────────────
// Static OOXML parts
// ───────────────────────────────────────────────────────────────────────────

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

// rId1 = manifest sheet, rId2 = styles, rId3 = gallery sheet, rId4 = cover sheet.
const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
</Relationships>`;

function buildWorkbookXml(sheetName: string, coverName = COVER_TITLE): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
    <sheet name="${escapeXml(GALLERY_TITLE)}" sheetId="2" r:id="rId3"/>
    <sheet name="${escapeXml(coverName)}" sheetId="3" r:id="rId4"/>
  </sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;
}

/**
 * Distinctive emerald/teal + gold styling (NOT the repeated indigo):
 * deep-emerald header with white bold text, dark-emerald merged title row
 * with larger gold bold text, soft emerald-tint alternating rows, thin slate
 * borders, blue-underline hyperlinks, and a `#,##0 "بايت"` number format.
 *
 * cellXfs legend (indices frozen — tests rely on them):
 *   0 default · 1 header · 2 data-alt · 3 data · 4 size-alt · 5 size ·
 *   6 hyperlink-alt · 7 hyperlink · 8 title · 9 center · 10 center-alt ·
 *   11 caption · 12 caption-hyperlink
 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0 &quot;بايت&quot;"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FFFCD34D"/><name val="Segoe UI"/><family val="2"/></font>
    <font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF065F46"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF064E3B"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="13">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const EXT_CONTENT_TYPE: Record<XlsxImageExt, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
};

function buildContentTypesXml(imageExts: XlsxImageExt[], hasDrawing: boolean): string {
  const defaults = [...new Set(imageExts)]
    .map((ext) => `  <Default Extension="${ext}" ContentType="${EXT_CONTENT_TYPE[ext]}"/>`)
    .join("\n");
  const overrides = [
    `  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`,
    `  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    `  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    `  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    `  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`,
  ];
  if (hasDrawing) {
    overrides.push(
      `  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
      `  <Override PartName="/xl/drawings/drawing2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
${defaults}
${overrides.join("\n")}
</Types>`;
}

// ───────────────────────────────────────────────────────────────────────────
// Dynamic parts (sheets, rels, drawings)
// ───────────────────────────────────────────────────────────────────────────

interface ManifestAnchor {
  /** 0-based data-row index (worksheet row = index + 3). */
  rowIndex: number;
  /** Relationship id inside drawing1.xml.rels. */
  relId: string;
  /** Media part name (`xl/media/imageN.ext`). */
  mediaName: string;
}

interface GalleryAnchor {
  /** Grid column (0..GALLERY_COLS-1) — also the drawing anchor column. */
  colIndex: number;
  /** 0-based worksheet row of the image anchor. */
  rowIndex: number;
  /** Relationship id inside drawing2.xml.rels (image rel). */
  relId: string;
  /** Relationship id inside drawing2.xml.rels (file hyperlink rel). */
  hlinkId: string;
  /** Media part name (`xl/media/imageN.ext`). */
  mediaName: string;
}

function dataRowXml(row: XlsxDocRow, r: number): string {
  const alt = r % 2 === 1; // alternate shading on every other data row
  const textStyle = alt ? 2 : 3;
  const sizeStyle = alt ? 4 : 5;
  const linkStyle = alt ? 6 : 7;
  const centerStyle = alt ? 10 : 9;
  const cells = [
    numberCell(cellRef(0, r), centerStyle, row.index),
    inlineStringCell(cellRef(1, r), textStyle, row.title),
    inlineStringCell(cellRef(2, r), textStyle, row.docNumber ?? "—"),
    inlineStringCell(cellRef(3, r), textStyle, row.docType ?? "—"),
    inlineStringCell(cellRef(4, r), textStyle, row.status),
    inlineStringCell(cellRef(5, r), textStyle, row.departmentName ?? "—"),
    inlineStringCell(cellRef(6, r), textStyle, row.date),
    numberCell(cellRef(7, r), sizeStyle, row.fileSize),
    inlineStringCell(cellRef(8, r), linkStyle, row.entryName),
    emptyCell(cellRef(9, r), centerStyle),
  ];
  return `<row r="${r}" ht="${ROW_HEIGHT_PT}" customHeight="1">${cells.join("")}</row>`;
}

function hyperlinksXml(rows: XlsxDocRow[], col: number): string {
  return rows.length
    ? `<hyperlinks>${rows
        .map(
          (row, i) =>
            `<hyperlink ref="${cellRef(col, i + 3)}" r:id="rId${i + 1}" tooltip="فتح الملف داخل الحزمة"/>`,
        )
        .join("")}</hyperlinks>`
    : "";
}

function footerRowXml(rows: XlsxDocRow[], r: number): string {
  // Totals footer on the dark-emerald header style (xf 1): COUNT in col A,
  // label in col B, SUM formula over the size column (H) — live in Excel.
  const lastData = rows.length + 2;
  const cells: string[] = [];
  for (let c = 0; c < COLUMN_COUNT; c += 1) {
    const ref = cellRef(c, r);
    if (c === 0) cells.push(numberCell(ref, 1, rows.length));
    else if (c === 1) cells.push(inlineStringCell(ref, 1, `الإجمالي — ${rows.length} مستند`));
    else if (c === 7)
      cells.push(
        rows.length > 0
          ? `<c r="${ref}" s="1"><f>SUM(H3:H${lastData})</f><v>0</v></c>`
          : emptyCell(ref, 1),
      );
    else cells.push(emptyCell(ref, 1));
  }
  return `<row r="${r}" ht="${HEADER_ROW_PT}" customHeight="1">${cells.join("")}</row>`;
}

function buildSheetXml(
  rows: XlsxDocRow[],
  opts: XlsxOptions,
  hasDrawing: boolean,
): string {
  const title = opts.title ?? DEFAULT_TITLE;
  // Every cell of the merged A1:J1 range must exist — otherwise Excel repairs
  // the sheet (merged but missing B1..J1).
  const titleCells = [inlineStringCell("A1", 8, title)];
  for (let c = 1; c < COLUMN_COUNT; c += 1) titleCells.push(emptyCell(cellRef(c, 1), 8));
  const titleRow = `<row r="1" ht="${TITLE_ROW_PT}" customHeight="1">${titleCells.join("")}</row>`;
  const headerRow = `<row r="2" ht="${HEADER_ROW_PT}" customHeight="1">${HEADERS.map(
    (h, i) => inlineStringCell(cellRef(i, 2), 1, h),
  ).join("")}</row>`;
  const dataRows = rows.map((row, i) => dataRowXml(row, i + 3)).join("");
  const footerRow = rows.length > 0 ? footerRowXml(rows, rows.length + 3) : "";
  const drawing = hasDrawing ? `<drawing r:id="rId${rows.length + 1}"/>` : "";
  const cols = COL_WIDTHS.map(
    (w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`,
  ).join("");
  const lastCol = colLetter(COLUMN_COUNT - 1);
  const lastRow = rows.length > 0 ? rows.length + 3 : 2;
  const autoFilter =
    rows.length > 0 ? `<autoFilter ref="A2:${lastCol}${rows.length + 2}"/>` : "";

  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`,
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`,
    `<dimension ref="A1:${lastCol}${lastRow}"/>`,
    `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`,
    `<cols>${cols}</cols>`,
    `<sheetData>${titleRow}${headerRow}${dataRows}${footerRow}</sheetData>`,
    autoFilter,
    `<mergeCells count="1"><mergeCell ref="A1:${lastCol}1"/></mergeCells>`,
    hyperlinksXml(rows, HYPERLINK_COL),
    `<printOptions horizontalCentered="1"/>`,
    `<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>`,
    `<pageSetup paperSize="9" orientation="landscape" fitToPage="1" fitToWidth="1" fitToHeight="0"/>`,
    drawing,
    `</worksheet>`,
    ``,
  ].join("\n");
}

function formatBytesAr(n: number): string {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} غيغابايت`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(2)} ميغابايت`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} كيلوبايت`;
  return `${n} بايت`;
}

function buildCoverXml(rows: XlsxDocRow[], opts: XlsxOptions): string {
  const coverName = opts.coverSheetName ?? COVER_TITLE;
  void coverName;
  const title = opts.title ?? DEFAULT_TITLE;
  const generatedAt = opts.generatedAt ?? title.replace(/^كشف المستندات\s*—\s*/, "") ?? "";
  const totalBytes = rows.reduce((s, r) => s + r.fileSize, 0);
  const byStatus = new Map<string, number>();
  const byDept = new Map<string, number>();
  for (const r of rows) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    byDept.set(r.departmentName ?? "—", (byDept.get(r.departmentName ?? "—") ?? 0) + 1);
  }
  const meta: Array<[string, string]> = [
    ["EDMS", "EDMS — نظام إدارة المستندات المؤسسي"],
    ["تاريخ الإصدار", generatedAt || "—"],
    ["عدد المستندات", String(rows.length)],
    ["إجمالي الأحجام", `${formatBytesAr(totalBytes)} (${totalBytes} بايت)`],
  ];
  const metaRows = meta
    .map(
      ([k, v], i) =>
        `<row r="${i + 2}" ht="22" customHeight="1">${inlineStringCell(`A${i + 2}`, 1, k)}${inlineStringCell(`B${i + 2}`, i % 2 === 0 ? 2 : 3, v)}${emptyCell(`C${i + 2}`, i % 2 === 0 ? 2 : 3)}${emptyCell(`D${i + 2}`, i % 2 === 0 ? 2 : 3)}</row>`,
    )
    .join("");
  let r = meta.length + 3;
  const sections: string[] = [];
  const mergeRows: number[] = [1];
  sections.push(
    `<row r="${r}" ht="26" customHeight="1">${inlineStringCell(`A${r}`, 8, "ملخص حسب الحالة")}${emptyCell(`B${r}`, 8)}${emptyCell(`C${r}`, 8)}${emptyCell(`D${r}`, 8)}</row>`,
  );
  mergeRows.push(r);
  r += 1;
  sections.push(
    `<row r="${r}" ht="22" customHeight="1">${inlineStringCell(`A${r}`, 1, "الحالة")}${inlineStringCell(`B${r}`, 1, "العدد")}sa${emptyCell(`C${r}`, 1)}${emptyCell(`D${r}`, 1)}</row>`.replace("sa", ""),
  );
  r += 1;
  const statusEntries = [...byStatus.entries()].sort((a, b) => b[1] - a[1]);
  if (statusEntries.length === 0) {
    sections.push(
      `<row r="${r}" ht="20" customHeight="1">${inlineStringCell(`A${r}`, 3, "—")}${inlineStringCell(`B${r}`, 3, "0")}${emptyCell(`C${r}`, 3)}${emptyCell(`D${r}`, 3)}</row>`,
    );
    r += 1;
  }
  for (const [k, v] of statusEntries) {
    const alt = r % 2 === 0;
    sections.push(
      `<row r="${r}" ht="20" customHeight="1">${inlineStringCell(`A${r}`, alt ? 2 : 3, k)}${inlineStringCell(`B${r}`, alt ? 2 : 3, String(v))}${emptyCell(`C${r}`, alt ? 2 : 3)}${emptyCell(`D${r}`, alt ? 2 : 3)}</row>`,
    );
    r += 1;
  }
  sections.push(
    `<row r="${r}" ht="26" customHeight="1">${inlineStringCell(`A${r}`, 8, "ملخص حسب القسم")}${emptyCell(`B${r}`, 8)}${emptyCell(`C${r}`, 8)}${emptyCell(`D${r}`, 8)}</row>`,
  );
  mergeRows.push(r);
  r += 1;
  sections.push(
    `<row r="${r}" ht="22" customHeight="1">${inlineStringCell(`A${r}`, 1, "القسم")}${inlineStringCell(`B${r}`, 1, "العدد")}${emptyCell(`C${r}`, 1)}${emptyCell(`D${r}`, 1)}</row>`,
  );
  r += 1;
  const deptEntries = [...byDept.entries()].sort((a, b) => b[1] - a[1]);
  if (deptEntries.length === 0) {
    sections.push(
      `<row r="${r}" ht="20" customHeight="1">${inlineStringCell(`A${r}`, 3, "—")}${inlineStringCell(`B${r}`, 3, "0")}${emptyCell(`C${r}`, 3)}${emptyCell(`D${r}`, 3)}</row>`,
    );
    r += 1;
  }
  for (const [k, v] of deptEntries) {
    const alt = r % 2 === 0;
    sections.push(
      `<row r="${r}" ht="20" customHeight="1">${inlineStringCell(`A${r}`, alt ? 2 : 3, k)}${inlineStringCell(`B${r}`, alt ? 2 : 3, String(v))}${emptyCell(`C${r}`, alt ? 2 : 3)}${emptyCell(`D${r}`, alt ? 2 : 3)}</row>`,
    );
    r += 1;
  }
  const lastRow = r - 1;
  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`,
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`,
    `<dimension ref="A1:D${lastRow}"/>`,
    `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`,
    `<cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="48" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="18" customWidth="1"/></cols>`,
    `<sheetData><row r="1" ht="32" customHeight="1">${inlineStringCell("A1", 8, `EDMS ◆ ${title}`)}${emptyCell("B1", 8)}${emptyCell("C1", 8)}${emptyCell("D1", 8)}</row>${metaRows}${sections.join("")}</sheetData>`,
    `<mergeCells count="${mergeRows.length}">${mergeRows.map((rr) => `<mergeCell ref="A${rr}:D${rr}"/>`).join("")}</mergeCells>`,
    `<printOptions horizontalCentered="1"/>`,
    `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>`,
    `<pageSetup paperSize="9" orientation="landscape" fitToPage="1" fitToWidth="1" fitToHeight="1"/>`,
    `</worksheet>`,
    ``,
  ].join("\n");
}

function buildSheetRelsXml(rows: XlsxDocRow[], hasDrawing: boolean, linkBase: string): string {
  const rels = rows.map(
    (row, i) =>
      // Raw Unicode file name (XML-escaped), NOT percent-encoded — see
      // hyperlinkTarget() for why percent-encoding breaks sibling-file links.
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(hyperlinkTarget(row.entryName, linkBase))}" TargetMode="External"/>`,
  );
  if (hasDrawing) {
    rels.push(
      `<Relationship Id="rId${rows.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels.join("\n")}
</Relationships>`;
}

function buildGalleryXml(rows: XlsxDocRow[], anchors: GalleryAnchor[], hasDrawing: boolean): string {
  // Every cell of the merged A1:D1 range must exist — otherwise Excel repairs
  // the sheet (merged but missing B1..D1).
  const galleryTitleCells = [inlineStringCell("A1", 8, GALLERY_TITLE)];
  for (let c = 1; c < GALLERY_COLS; c += 1) galleryTitleCells.push(emptyCell(cellRef(c, 1), 8));
  const titleRow = `<row r="1" ht="${TITLE_ROW_PT}" customHeight="1">${galleryTitleCells.join("")}</row>`;

  // Row-major grid: image row (ht 98, bordered empty cells) + caption row
  // (ht 32, centered wrapped text, hyperlink style) per 4-doc block.
  const blockCount = anchors.length ? Math.floor((anchors.length - 1) / GALLERY_COLS) + 1 : 0;
  const gridRows: string[] = [];
  for (let b = 0; b < blockCount; b += 1) {
    const imageRow = 2 + 2 * b;
    const captionRow = imageRow + 1;
    const imageCells: string[] = [];
    const captionCells: string[] = [];
    for (let c = 0; c < GALLERY_COLS; c += 1) {
      const k = b * GALLERY_COLS + c;
      imageCells.push(emptyCell(cellRef(c, imageRow), 9));
      captionCells.push(
        k < rows.length
          ? // Two-line caption: document title, then its reference. The raw
            // newline inside <t xml:space="preserve"> is preserved and shown
            // because the caption style sets wrapText.
            inlineStringCell(
              cellRef(c, captionRow),
              12,
              `${rows[k].title}\nالرقم المرجعي: ${rows[k].docNumber ?? "—"}`,
            )
          : emptyCell(cellRef(c, captionRow), 9),
      );
    }
    gridRows.push(`<row r="${imageRow}" ht="${GALLERY_IMG_ROW_PT}" customHeight="1">${imageCells.join("")}</row>`);
    gridRows.push(`<row r="${captionRow}" ht="${GALLERY_CAPTION_ROW_PT}" customHeight="1">${captionCells.join("")}</row>`);
  }

  const galleryHyperlinks = rows.length
    ? `<hyperlinks>${rows
        .map(
          (row, i) =>
            `<hyperlink ref="${cellRef(i % GALLERY_COLS, galleryCaptionRow(i))}" r:id="rId${i + 1}" tooltip="فتح الملف داخل الحزمة"/>`,
        )
        .join("")}</hyperlinks>`
    : "";
  const drawing = hasDrawing ? `<drawing r:id="rId${rows.length + 1}"/>` : "";
  const lastRow = anchors.length ? galleryCaptionRow(anchors.length - 1) : 1;
  const cols = Array.from({ length: GALLERY_COLS }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${GALLERY_COL_WIDTH}" customWidth="1"/>`).join("");

  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`,
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`,
    `<dimension ref="A1:D${lastRow}"/>`,
    // LTR by design (see GALLERY_COLS comment): grid columns must map 1:1 to
    // visual positions. The title row is frozen for long galleries.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`,
    `<cols>${cols}</cols>`,
    `<sheetData>${titleRow}${gridRows.join("")}</sheetData>`,
    `<mergeCells count="1"><mergeCell ref="A1:D1"/></mergeCells>`,
    galleryHyperlinks,
    `<printOptions horizontalCentered="1"/>`,
    `<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>`,
    `<pageSetup paperSize="9" orientation="landscape" fitToPage="1" fitToWidth="1" fitToHeight="0"/>`,
    drawing,
    `</worksheet>`,
    ``,
  ].join("\n");
}

function buildGalleryRelsXml(rows: XlsxDocRow[], hasDrawing: boolean, linkBase: string): string {
  const rels = rows.map(
    (row, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(hyperlinkTarget(row.entryName, linkBase))}" TargetMode="External"/>`,
  );
  if (hasDrawing) {
    rels.push(
      `<Relationship Id="rId${rows.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing2.xml"/>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels.join("\n")}
</Relationships>`;
}

/** Drawing for the manifest preview column (one 64px anchor per row at col J).
 *
 * REPAIR FIX (ECMA-376 Transitional): anchors are `xdr:twoCellAnchor` with an
 * explicit `editAs="oneCell"` — never bare `xdr:oneCellAnchor`. The one-cell
 * form carries no editAs attribute and is the form Excel most often discards
 * with "repaired parts: drawing1.xml / drawing2.xml"; the two-cell form with
 * editAs="oneCell" is what Excel itself writes and round-trips reliably.
 * Sequence per CT_TwoCellAnchor is from + to + pic + clientData (no `ext`
 * child — the render size lives in spPr/xfrm and in the `to` marker above).
 */
function buildDrawingXml(anchors: ManifestAnchor[]): string {
  const body = anchors
    .map(
      (a, i) => `<xdr:twoCellAnchor editAs="oneCell">
      <xdr:from><xdr:col>${PREVIEW_COL}</xdr:col><xdr:colOff>${PREVIEW_COL_OFFSET_EMU}</xdr:colOff><xdr:row>${a.rowIndex + 2}</xdr:row><xdr:rowOff>${PREVIEW_ROW_OFFSET_EMU}</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>${PREVIEW_COL}</xdr:col><xdr:colOff>${PREVIEW_TO_COL_OFF_EMU}</xdr:colOff><xdr:row>${a.rowIndex + 2}</xdr:row><xdr:rowOff>${PREVIEW_TO_ROW_OFF_EMU}</xdr:rowOff></xdr:to>
      <xdr:pic>
        <xdr:nvPicPr>
          <xdr:cNvPr id="${i + 2}" name="preview-${i + 1}"/>
          <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
        </xdr:nvPicPr>
        <xdr:blipFill><a:blip r:embed="${a.relId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
        <xdr:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="${PREVIEW_EMU}" cy="${PREVIEW_EMU}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:ln w="${BORDER_EMU}"><a:solidFill><a:srgbClr val="FFCBD5E1"/></a:solidFill></a:ln>
        </xdr:spPr>
      </xdr:pic>
      <xdr:clientData/>
    </xdr:twoCellAnchor>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${body}
</xdr:wsDr>`;
}

/**
 * Drawing for the gallery grid: one ~150×110px anchor per document, centered
 * in its grid cell with a thin border; each picture carries the file hyperlink
 * via `a:hlinkClick` so clicking the image opens the document. Same
 * twoCellAnchor + editAs="oneCell" form as the manifest drawing (see above).
 */
function buildGalleryDrawingXml(anchors: GalleryAnchor[]): string {
  const body = anchors
    .map(
      (a, i) => `<xdr:twoCellAnchor editAs="oneCell">
      <xdr:from><xdr:col>${a.colIndex}</xdr:col><xdr:colOff>${GALLERY_COL_OFFSET_EMU}</xdr:colOff><xdr:row>${a.rowIndex}</xdr:row><xdr:rowOff>${GALLERY_ROW_OFFSET_EMU}</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>${a.colIndex}</xdr:col><xdr:colOff>${GALLERY_TO_COL_OFF_EMU}</xdr:colOff><xdr:row>${a.rowIndex}</xdr:row><xdr:rowOff>${GALLERY_TO_ROW_OFF_EMU}</xdr:rowOff></xdr:to>
      <xdr:pic>
        <xdr:nvPicPr>
          <xdr:cNvPr id="${i + 2}" name="gallery-${i + 1}"><a:hlinkClick r:id="${a.hlinkId}" tooltip="فتح الملف داخل الحزمة"/></xdr:cNvPr>
          <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
        </xdr:nvPicPr>
        <xdr:blipFill><a:blip r:embed="${a.relId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
        <xdr:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="${GALLERY_IMG_W_EMU}" cy="${GALLERY_IMG_H_EMU}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:ln w="${BORDER_EMU}"><a:solidFill><a:srgbClr val="FFCBD5E1"/></a:solidFill></a:ln>
        </xdr:spPr>
      </xdr:pic>
      <xdr:clientData/>
    </xdr:twoCellAnchor>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${body}
</xdr:wsDr>`;
}

function buildDrawingRelsXml(anchors: Array<{ relId: string; mediaName: string }>): string {
  const rels = anchors.map(
    (a) =>
      `<Relationship Id="${a.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../${a.mediaName.slice(3)}"/>`,
  );
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels.join("\n")}
</Relationships>`;
}

/**
 * Gallery drawing rels: image relationships first (rId1..rIdN, one per doc),
 * then the file-hyperlink relationships referenced by the pictures' hlinkClick
 * (rIdN+1..rId2N). Same raw-Unicode targets as the sheet rels.
 */
function buildGalleryDrawingRelsXml(anchors: GalleryAnchor[], rows: XlsxDocRow[], linkBase: string): string {
  const imageRels = anchors.map(
    (a) =>
      `<Relationship Id="${a.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../${a.mediaName.slice(3)}"/>`,
  );
  const hlinkRels = rows.map(
    (row, i) =>
      `<Relationship Id="rId${rows.length + i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(hyperlinkTarget(row.entryName, linkBase))}" TargetMode="External"/>`,
  );
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${[...imageRels, ...hlinkRels].join("\n")}
</Relationships>`;
}

// ───────────────────────────────────────────────────────────────────────────
// Assembly
// ───────────────────────────────────────────────────────────────────────────

interface XlsxPlan {
  sheetXml: string;
  sheetRelsXml: string;
  galleryXml: string;
  galleryRelsXml: string;
  coverXml: string;
  drawingXml: string | null;
  drawingRelsXml: string | null;
  galleryDrawingXml: string | null;
  galleryDrawingRelsXml: string | null;
  media: XlsxPart[];
  imageExts: XlsxImageExt[];
}

/**
 * Plan the dynamic parts from the rows:
 * - One preview media part per row that has a raster preview (thumb first).
 * - A single shared placeholder-icon part (deduplicated) for rows without —
 *   both worksheets reference the same part, so 3 placeholders still cost one
 *   media entry.
 * - Manifest drawing anchors (rId1..rIdN in drawing1.xml.rels) and gallery
 *   drawing anchors (rId1..rIdN images + rIdN+1..rId2N hyperlinks in
 *   drawing2.xml.rels) share those media parts. Each sheet's hyperlink rIds
 *   are rId1..rIdN and the sheet drawing gets rIdN+1.
 */
function planXlsx(rows: XlsxDocRow[], opts: XlsxOptions): XlsxPlan {
  const manifestAnchors: ManifestAnchor[] = [];
  const galleryAnchors: GalleryAnchor[] = [];
  const media: XlsxPart[] = [];
  let iconName: string | null = null;
  let nextMedia = 1;

  for (let i = 0; i < rows.length; i += 1) {
    const preview = rows[i].preview;
    let mediaName: string;
    if (preview) {
      mediaName = `xl/media/image${nextMedia}.${preview.ext}`;
      nextMedia += 1;
      media.push({ name: mediaName, data: preview.data });
    } else {
      if (!iconName) {
        iconName = `xl/media/image${nextMedia}.png`;
        nextMedia += 1;
        media.push({ name: iconName, data: buildPlaceholderPng() });
      }
      mediaName = iconName;
    }
    manifestAnchors.push({ rowIndex: i, relId: `rId${i + 1}`, mediaName });
    galleryAnchors.push({
      colIndex: i % GALLERY_COLS,
      rowIndex: galleryImageRow(i) - 1, // worksheet row 2+2·block → 0-based row 1+2·block
      relId: `rId${i + 1}`,
      hlinkId: `rId${rows.length + i + 1}`,
      mediaName,
    });
  }

  const imageExts = [...new Set(media.map((m) => m.name.split(".").pop() as XlsxImageExt))];
  const hasDrawing = manifestAnchors.length > 0;
  const linkBase = opts.linkBasePath ?? DEFAULT_LINK_BASE_PATH;

  return {
    sheetXml: buildSheetXml(rows, opts, hasDrawing),
    sheetRelsXml: buildSheetRelsXml(rows, hasDrawing, linkBase),
    galleryXml: buildGalleryXml(rows, galleryAnchors, hasDrawing),
    galleryRelsXml: buildGalleryRelsXml(rows, hasDrawing, linkBase),
    coverXml: buildCoverXml(rows, opts),
    drawingXml: hasDrawing ? buildDrawingXml(manifestAnchors) : null,
    drawingRelsXml: hasDrawing ? buildDrawingRelsXml(manifestAnchors) : null,
    galleryDrawingXml: hasDrawing ? buildGalleryDrawingXml(galleryAnchors) : null,
    galleryDrawingRelsXml: hasDrawing ? buildGalleryDrawingRelsXml(galleryAnchors, rows, linkBase) : null,
    media,
    imageExts,
  };
}

/**
 * Build the complete list of XLSX container parts. Pure and deterministic —
 * unit-tested without any archiver/disk interaction.
 */
export function buildXlsxParts(rows: XlsxDocRow[], opts: XlsxOptions = {}): XlsxPart[] {
  const plan = planXlsx(rows, opts);
  const parts: XlsxPart[] = [
    {
      name: "[Content_Types].xml",
      data: Buffer.from(buildContentTypesXml(plan.imageExts, plan.drawingXml !== null), "utf8"),
    },
    { name: "_rels/.rels", data: Buffer.from(ROOT_RELS_XML, "utf8") },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(
        buildWorkbookXml(opts.sheetName ?? SHEET_NAME, opts.coverSheetName ?? COVER_TITLE),
        "utf8",
      ),
    },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(WORKBOOK_RELS_XML, "utf8") },
    { name: "xl/styles.xml", data: Buffer.from(STYLES_XML, "utf8") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(plan.sheetXml, "utf8") },
    { name: "xl/worksheets/_rels/sheet1.xml.rels", data: Buffer.from(plan.sheetRelsXml, "utf8") },
    { name: "xl/worksheets/sheet2.xml", data: Buffer.from(plan.galleryXml, "utf8") },
    { name: "xl/worksheets/_rels/sheet2.xml.rels", data: Buffer.from(plan.galleryRelsXml, "utf8") },
    { name: "xl/worksheets/sheet3.xml", data: Buffer.from(plan.coverXml, "utf8") },
  ];
  if (plan.drawingXml) {
    parts.push(
      { name: "xl/drawings/drawing1.xml", data: Buffer.from(plan.drawingXml, "utf8") },
      {
        name: "xl/drawings/_rels/drawing1.xml.rels",
        data: Buffer.from(plan.drawingRelsXml ?? "", "utf8"),
      },
      { name: "xl/drawings/drawing2.xml", data: Buffer.from(plan.galleryDrawingXml ?? "", "utf8") },
      {
        name: "xl/drawings/_rels/drawing2.xml.rels",
        data: Buffer.from(plan.galleryDrawingRelsXml ?? "", "utf8"),
      },
    );
  }
  for (const part of plan.media) parts.push(part);
  return parts;
}

/**
 * Assemble the parts into a real `.xlsx` ZIP in memory (the parts are small:
 * XML + ≤50 preview images). Uses `archiver` — the same library the route
 * uses for the outer archive — via static named import only.
 */
export async function buildXlsxBuffer(
  rows: XlsxDocRow[],
  opts: XlsxOptions = {},
): Promise<Buffer> {
  const parts = buildXlsxParts(rows, opts);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const pass = new PassThrough();
  archive.on("error", () => {
    pass.destroy();
  });
  archive.pipe(pass);

  const chunks: Buffer[] = [];
  pass.on("data", (chunk: Buffer) => chunks.push(chunk));

  try {
    await new Promise<void>((resolve, reject) => {
      pass.on("end", resolve);
      pass.on("error", reject);
      for (const part of parts) archive.append(part.data, { name: part.name });
      void archive.finalize().catch(reject);
    });
  } finally {
    pass.destroy();
  }
  return Buffer.concat(chunks);
}