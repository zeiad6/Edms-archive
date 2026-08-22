import { describe, it, expect } from "vitest";
import { inflateRawSync } from "node:zlib";
import {
  buildXlsxBuffer,
  buildXlsxParts,
  buildPlaceholderPng,
  GALLERY_COLS,
  type XlsxDocRow,
  type XlsxPreview,
} from "../xlsx";

// ───────────────────────────────────────────────────────────────────────────
// Test-only mini ZIP reader: walks the central directory and inflates
// entries with node:zlib (method 0 = stored, method 8 = deflate).
// ───────────────────────────────────────────────────────────────────────────

interface ZipEntry {
  name: string;
  data: Buffer;
}

function readZipEntries(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  const start = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= start; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd).toBeGreaterThanOrEqual(0);
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    expect(buf.readUInt32LE(offset)).toBe(0x02014b50);
    const method = buf.readUInt16LE(offset + 10);
    const csize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOff = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);
    const dataStart = localOff + 30 + nameLen + buf.readUInt16LE(localOff + 28);
    const compressed = buf.subarray(dataStart, dataStart + csize);
    const data =
      method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : Buffer.alloc(0);
    entries.push({ name, data });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ───────────────────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────────────────

const OPTIONS = {
  title: "كشف المستندات — ١٦ أغسطس ٢٠٢٦",
};

function previewPng(): XlsxPreview {
  return { data: buildPlaceholderPng(48), ext: "png", contentType: "image/png" };
}

function previewJpg(): XlsxPreview {
  return { data: buildPlaceholderPng(48), ext: "jpg", contentType: "image/jpeg" };
}

function makeRow(overrides: Partial<XlsxDocRow> = {}): XlsxDocRow {
  return {
    index: 1,
    title: "عقد توريد",
    docNumber: "REF-2026-001",
    docType: "عقد",
    status: "ساري",
    departmentName: "قسم المشتريات",
    date: "١٢ مارس ٢٠٢٦",
    fileSize: 1_048_576,
    entryName: "عقد-توريد.pdf",
    preview: null,
    ...overrides,
  };
}

const REQUIRED_PARTS = [
  "[Content_Types].xml",
  "_rels/.rels",
  "xl/workbook.xml",
  "xl/_rels/workbook.xml.rels",
  "xl/styles.xml",
  "xl/worksheets/sheet1.xml",
  "xl/worksheets/_rels/sheet1.xml.rels",
  "xl/worksheets/sheet2.xml",
  "xl/worksheets/_rels/sheet2.xml.rels",
];

// ───────────────────────────────────────────────────────────────────────────
// buildPlaceholderPng
// ───────────────────────────────────────────────────────────────────────────

describe("buildPlaceholderPng", () => {
  it("produces a valid PNG with the expected dimensions", () => {
    const png = buildPlaceholderPng();
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(64); // width
    expect(png.readUInt32BE(20)).toBe(64); // height
    expect(png.toString("ascii", png.length - 8, png.length - 4)).toBe("IEND");
    expect(png.length).toBeGreaterThan(200);
  });

  it("is deterministic (identical bytes on every call)", () => {
    expect(buildPlaceholderPng().equals(buildPlaceholderPng())).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// buildXlsxParts — structure
// ───────────────────────────────────────────────────────────────────────────

describe("buildXlsxParts", () => {
  it("emits every required OOXML part for a mixed set of rows", () => {
    const rows = [makeRow({ index: 1, preview: previewPng() }), makeRow({ index: 2, entryName: "قرار إداري - 2026.pdf" })];
    const parts = buildXlsxParts(rows, OPTIONS);
    const names = parts.map((p) => p.name);
    for (const required of [
      ...REQUIRED_PARTS,
      "xl/drawings/drawing1.xml",
      "xl/drawings/_rels/drawing1.xml.rels",
      "xl/drawings/drawing2.xml",
      "xl/drawings/_rels/drawing2.xml.rels",
    ]) {
      expect(names).toContain(required);
    }
    // row 1 has a png preview, row 2 falls back to the shared icon → 2 media parts
    const media = names.filter((n) => n.startsWith("xl/media/"));
    expect(media).toEqual(["xl/media/image1.png", "xl/media/image2.png"]);
  });

  it("registers both sheets in the workbook (manifest + gallery)", () => {
    const parts = buildXlsxParts([makeRow()], OPTIONS);
    const workbook = parts.find((p) => p.name === "xl/workbook.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/_rels/workbook.xml.rels")!.data.toString("utf8");

    expect(workbook).toContain('<sheet name="كشف المستندات" sheetId="1" r:id="rId1"/>');
    expect(workbook).toContain('<sheet name="صور المستندات" sheetId="2" r:id="rId3"/>');
    expect(rels).toContain('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>');
    expect(rels).toContain('<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');
    expect(rels).toContain('<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>');
  });

  it("builds an RTL sheet with a merged title row, Arabic headers and styled rows", () => {
    const parts = buildXlsxParts([makeRow()], OPTIONS);
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");

    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('<mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells>');
    expect(sheet).toContain("كشف المستندات — ١٦ أغسطس ٢٠٢٦");
    expect(sheet).toContain('<col min="1" max="1" width="5" customWidth="1"/>');
    // preview column widened to ~96px (13 chars) so 64px thumbnails fit
    expect(sheet).toContain('<col min="10" max="10" width="13" customWidth="1"/>');
    // header row (row 2) with all Arabic headers in order
    const headerRow = sheet.match(/<row r="2"[^>]*>.*?<\/row>/)?.[0] ?? "";
    for (const header of ["م", "العنوان", "الرقم المرجعي", "النوع", "الحالة", "القسم", "التاريخ", "الحجم", "الملف", "المعاينة"]) {
      expect(headerRow).toContain(`>${header}<`);
    }
    // title row style + frozen header pane
    expect(sheet).toContain('<row r="1" ht="32" customHeight="1"><c r="A1" s="8"');
    expect(sheet).toContain('state="frozen"');
  });

  it("writes row numbering, sizes and per-row styling in order", () => {
    const parts = buildXlsxParts(
      [
        makeRow({ index: 1, fileSize: 1_048_576 }),
        makeRow({ index: 2, fileSize: 2_097_152, docNumber: "REF-2" }),
      ],
      OPTIONS,
    );
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");

    expect(sheet).toContain('<dimension ref="A1:J4"/>');
    // data rows are 52pt tall — 64px preview + breathing room
    expect(sheet).toContain('<row r="3" ht="52" customHeight="1">');
    expect(sheet).toContain('<row r="4" ht="52" customHeight="1">');
    expect(sheet).toContain('<c r="A3" s="10"><v>1</v></c>');
    expect(sheet).toContain('<c r="A4" s="9"><v>2</v></c>'); // alternating row style
    expect(sheet).toContain('<c r="H3" s="4"><v>1048576</v></c>');
    expect(sheet).toContain('<c r="H4" s="5"><v>2097152</v></c>'); // size-alt style
    expect(sheet).toContain('<c r="B3" s="2"');
    expect(sheet).toContain('<c r="B4" s="3"'); // data-alt style
  });

  it("keeps a placeholder icon for non-raster documents and dedupes it", () => {
    const rows = [
      makeRow({ index: 1 }), // placeholder
      makeRow({ index: 2 }), // placeholder
      makeRow({ index: 3, preview: previewJpg() }),
    ];
    const parts = buildXlsxParts(rows, OPTIONS);
    const media = parts.filter((p) => p.name.startsWith("xl/media/"));
    // exactly one shared icon + one jpg preview
    expect(media.map((m) => m.name)).toEqual(["xl/media/image1.png", "xl/media/image2.jpg"]);

    const drawing = parts.find((p) => p.name === "xl/drawings/drawing1.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/drawings/_rels/drawing1.xml.rels")!.data.toString("utf8");
    // three anchors, three image rels — two of them point at the same icon part
    expect(drawing.match(/<xdr:oneCellAnchor>/g)).toHaveLength(3);
    expect(rels.match(/relationships\/image"/g)).toHaveLength(3);
    expect(rels).toContain('Target="../media/image1.png"');
    expect(rels).toContain('Target="../media/image2.jpg"');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Hyperlinks — the link ↔ archive contract
// ───────────────────────────────────────────────────────────────────────────

describe("hyperlinks", () => {
  it("declares an external hyperlink per row with the raw Unicode file name as target", () => {
    const parts = buildXlsxParts([makeRow({ entryName: "قرار إداري - 2026.pdf" })], OPTIONS);
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/worksheets/_rels/sheet1.xml.rels")!.data.toString("utf8");

    expect(sheet).toContain('<hyperlink ref="I3" r:id="rId1" tooltip="فتح الملف داخل الحزمة"/>');
    expect(rels).toContain('TargetMode="External"');
    // Excel does NOT percent-decode relative external targets — the target
    // must be the literal sibling file name (see hyperlinkTarget).
    expect(rels).toContain('Target="قرار إداري - 2026.pdf" TargetMode="External"');
    expect(rels).not.toContain("%20");
    expect(rels).not.toContain("%D8%");
    // display text keeps the raw file name
    expect(sheet).toContain("<t xml:space=\"preserve\">قرار إداري - 2026.pdf</t>");
  });

  it("every hyperlink target equals the exact ZIP entry name (raw, no percent-decoding)", () => {
    const names = ["عقد-توريد.pdf", "قرار إداري - 2026.pdf", "فاتورة (شهر 8).xlsx", "مذكرة#سرية?.doc"];
    const parts = buildXlsxParts(
      names.map((entryName, i) => makeRow({ index: i + 1, entryName })),
      OPTIONS,
    );
    const rels = parts.find((p) => p.name === "xl/worksheets/_rels/sheet1.xml.rels")!.data.toString("utf8");
    const targets = [...rels.matchAll(/Target="([^"]+)" TargetMode="External"/g)].map((m) => m[1]);
    // raw equality — only the URI fragment delimiter # is escaped (%23)
    expect(targets).toEqual([
      "عقد-توريد.pdf",
      "قرار إداري - 2026.pdf",
      "فاتورة (شهر 8).xlsx",
      "مذكرة%23سرية?.doc",
    ]);
  });

  it("keeps the drawing relationship id distinct from the hyperlink ids", () => {
    const parts = buildXlsxParts(
      [makeRow({ index: 1 }), makeRow({ index: 2 })],
      OPTIONS,
    );
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/worksheets/_rels/sheet1.xml.rels")!.data.toString("utf8");

    expect(sheet).toContain('<hyperlink ref="I3" r:id="rId1"');
    expect(sheet).toContain('<hyperlink ref="I4" r:id="rId2"');
    expect(sheet).toContain('<drawing r:id="rId3"/>');
    expect(rels).toContain('<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Drawing & media — image counts and reference integrity
// ───────────────────────────────────────────────────────────────────────────

describe("drawing & media", () => {
  it("anchors every row in the preview column with a fixed 64px size", () => {
    const parts = buildXlsxParts([makeRow({ index: 1, preview: previewJpg() })], OPTIONS);
    const drawing = parts.find((p) => p.name === "xl/drawings/drawing1.xml")!.data.toString("utf8");

    expect(drawing).toContain("<xdr:from><xdr:col>9</xdr:col>");
    // 64px thumbnails centered in the 52pt row (rowOff 25400) and ~96px column (colOff 152400)
    expect(drawing).toContain("<xdr:colOff>152400</xdr:colOff>");
    expect(drawing).toContain("<xdr:rowOff>25400</xdr:rowOff>");
    expect(drawing).toContain(`<xdr:ext cx="609600" cy="609600"/>`);
    expect(drawing).toContain('r:embed="rId1"');
    expect(drawing).toContain("<xdr:clientData/>");
  });

  it("media part count equals the number of available raster previews plus one shared icon", () => {
    const rows = [
      makeRow({ index: 1, preview: previewJpg() }),
      makeRow({ index: 2, preview: previewPng() }),
      makeRow({ index: 3 }), // placeholder
      makeRow({ index: 4, preview: previewJpg() }),
    ];
    const parts = buildXlsxParts(rows, OPTIONS);
    const media = parts.filter((p) => p.name.startsWith("xl/media/"));
    expect(media).toHaveLength(4); // 3 previews + 1 icon
    expect(media.map((m) => m.name)).toEqual([
      "xl/media/image1.jpg",
      "xl/media/image2.png",
      "xl/media/image3.png",
      "xl/media/image4.jpg",
    ]);
  });

  it("every drawing r:embed resolves to a relationship whose target exists as a media part", () => {
    const rows = [
      makeRow({ index: 1, preview: previewJpg() }),
      makeRow({ index: 2 }),
      makeRow({ index: 3, preview: previewPng() }),
      makeRow({ index: 4 }),
    ];
    const parts = buildXlsxParts(rows, OPTIONS);
    const drawing = parts.find((p) => p.name === "xl/drawings/drawing1.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/drawings/_rels/drawing1.xml.rels")!.data.toString("utf8");
    const mediaNames = parts.filter((p) => p.name.startsWith("xl/media/")).map((p) => p.name);

    const embedIds = [...drawing.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]);
    expect(embedIds).toEqual(["rId1", "rId2", "rId3", "rId4"]);
    for (const id of embedIds) {
      const target = rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`))?.[1];
      expect(target).toBeTruthy();
      const resolved = target!.startsWith("../") ? target!.slice(3) : target!; // ../media/… → media/…
      expect(mediaNames).toContain(`xl/${resolved}`);
    }
  });

  it("declares content types for exactly the image extensions used", () => {
    const parts = buildXlsxParts([makeRow({ index: 1, preview: previewJpg() })], OPTIONS);
    const types = parts.find((p) => p.name === "[Content_Types].xml")!.data.toString("utf8");
    expect(types).toContain('<Default Extension="jpg" ContentType="image/jpeg"/>');
    expect(types).not.toContain('Extension="gif"');
    expect(types).not.toContain('Extension="bmp"');
    expect(types).toContain('PartName="/xl/workbook.xml"');
    expect(types).toContain('PartName="/xl/worksheets/sheet1.xml"');
    expect(types).toContain('PartName="/xl/worksheets/sheet2.xml"');
    expect(types).toContain('PartName="/xl/styles.xml"');
    expect(types).toContain('PartName="/xl/drawings/drawing1.xml"');
    expect(types).toContain('PartName="/xl/drawings/drawing2.xml"');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Gallery sheet «صور المستندات»
// ───────────────────────────────────────────────────────────────────────────

describe("gallery sheet «صور المستندات»", () => {
  it("is exported with the documented grid width", () => {
    expect(GALLERY_COLS).toBe(4);
  });

  it("builds an LTR grid sheet with title, frozen pane, captions and per-doc hyperlinks", () => {
    const parts = buildXlsxParts(
      [
        makeRow({ index: 1, title: "عقد توريد", docNumber: "REF-2026-001" }),
        makeRow({ index: 2, title: "قرار إداري", docNumber: null }),
      ],
      OPTIONS,
    );
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet2.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/worksheets/_rels/sheet2.xml.rels")!.data.toString("utf8");

    // LTR by design — grid columns map 1:1 to visual positions (see GALLERY_COLS)
    expect(sheet).not.toContain("rightToLeft");
    expect(sheet).toContain("صور المستندات");
    expect(sheet).toContain('<mergeCells count="1"><mergeCell ref="A1:D1"/></mergeCells>');
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(sheet).toContain('<cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="3" width="24" customWidth="1"/><col min="4" max="4" width="24" customWidth="1"/></cols>');
    // block 0: image row (98pt) + caption row (32pt)
    expect(sheet).toContain('<row r="2" ht="98" customHeight="1">');
    expect(sheet).toContain('<row r="3" ht="32" customHeight="1">');
    // caption cells: two-line text (title + reference), hyperlink style 12
    expect(sheet).toContain('<c r="A3" s="12" t="inlineStr"><is><t xml:space="preserve">عقد توريد\nالرقم المرجعي: REF-2026-001</t></is></c>');
    expect(sheet).toContain('<c r="B3" s="12" t="inlineStr"><is><t xml:space="preserve">قرار إداري\nالرقم المرجعي: —</t></is></c>');
    // caption hyperlinks reference the raw sibling file
    expect(sheet).toContain('<hyperlink ref="A3" r:id="rId1" tooltip="فتح الملف داخل الحزمة"/>');
    expect(sheet).toContain('<hyperlink ref="B3" r:id="rId2" tooltip="فتح الملف داخل الحزمة"/>');
    expect(sheet).toContain('<drawing r:id="rId3"/>');
    expect(rels).toContain('Target="عقد-توريد.pdf" TargetMode="External"');
    expect(rels).toContain('<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing2.xml"/>');
  });

  it("fills the grid row-major (k → column k % 4, block k / 4) and wraps into the next block", () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow({ index: i + 1, title: `مستند ${i + 1}` }));
    const parts = buildXlsxParts(rows, OPTIONS);
    const drawing = parts.find((p) => p.name === "xl/drawings/drawing2.xml")!.data.toString("utf8");
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet2.xml")!.data.toString("utf8");

    // 5 docs → block 0 fills A..D, block 1 starts again at column A
    const froms = [
      ...drawing.matchAll(/<xdr:from><xdr:col>(\d+)<\/xdr:col><xdr:colOff>\d+<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row>/g),
    ].map((m) => [Number(m[1]), Number(m[2])]);
    expect(froms).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [0, 3],
    ]);
    // doc 5 lands in column A of block 1 → caption at A5, hyperlink rId5
    expect(sheet).toContain('<c r="A5" s="12" t="inlineStr"><is><t xml:space="preserve">مستند 5\nالرقم المرجعي: REF-2026-001</t></is></c>');
    expect(sheet).toContain('<hyperlink ref="A5" r:id="rId5" tooltip="فتح الملف داخل الحزمة"/>');
    expect(sheet).toContain('<dimension ref="A1:D5"/>');
  });

  it("sizes gallery images at ~150×110px centered with a thin border, clickable via hlinkClick", () => {
    const parts = buildXlsxParts([makeRow({ index: 1 })], OPTIONS);
    const drawing = parts.find((p) => p.name === "xl/drawings/drawing2.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/drawings/_rels/drawing2.xml.rels")!.data.toString("utf8");

    // 150×110px = 1428750×1047750 EMU, centered in the 173px column / 130px row
    expect(drawing).toContain(`<xdr:ext cx="1428750" cy="1047750"/>`);
    expect(drawing).toContain("<xdr:colOff>109538</xdr:colOff>");
    expect(drawing).toContain("<xdr:rowOff>98425</xdr:rowOff>");
    // 1pt thin border around the picture
    expect(drawing).toContain('<a:ln w="12700"><a:solidFill><a:srgbClr val="FFCBD5E1"/></a:solidFill></a:ln>');
    // image click opens the file (hyperlink rel lives after the image rels)
    expect(drawing).toContain('<a:hlinkClick r:id="rId2" tooltip="فتح الملف داخل الحزمة"/>');
    expect(rels).toContain('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>');
    expect(rels).toContain('<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="عقد-توريد.pdf" TargetMode="External"/>');
  });

  it("every gallery image r:embed resolves to a media part and every hlinkClick to a raw file target", () => {
    const rows = [
      makeRow({ index: 1, preview: previewJpg(), entryName: "عقد-توريد.pdf" }),
      makeRow({ index: 2, entryName: "قرار إداري - 2026.pdf" }),
      makeRow({ index: 3, preview: previewPng(), entryName: "فاتورة.xlsx" }),
    ];
    const parts = buildXlsxParts(rows, OPTIONS);
    const drawing = parts.find((p) => p.name === "xl/drawings/drawing2.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/drawings/_rels/drawing2.xml.rels")!.data.toString("utf8");
    const mediaNames = parts.filter((p) => p.name.startsWith("xl/media/")).map((p) => p.name);

    // images rId1..rId3 → existing media parts
    const embedIds = [...drawing.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]);
    expect(embedIds).toEqual(["rId1", "rId2", "rId3"]);
    for (const id of embedIds) {
      const target = rels.match(new RegExp(`Id="${id}"[^>]*relationships/image" Target="([^"]+)"`))?.[1];
      expect(target).toBeTruthy();
      expect(mediaNames).toContain(`xl/${target!.slice(3)}`);
    }
    // hyperlinks rId4..rId6 → raw entry names, no percent-encoding
    const hlinkIds = [...drawing.matchAll(/r:id="(rId[4-6])"/g)].map((m) => m[1]);
    expect(hlinkIds).toEqual(["rId4", "rId5", "rId6"]);
    for (const name of ["عقد-توريد.pdf", "قرار إداري - 2026.pdf", "فاتورة.xlsx"]) {
      expect(rels).toContain(`relationships/hyperlink" Target="${name}" TargetMode="External"`);
    }
  });

  it("is fully deterministic (identical XML on repeated builds)", () => {
    const rows = [
      makeRow({ index: 1, preview: previewPng() }),
      makeRow({ index: 2 }),
      makeRow({ index: 3, preview: previewJpg() }),
    ];
    const a = buildXlsxParts(rows, OPTIONS);
    const b = buildXlsxParts(rows, OPTIONS);
    for (const name of [
      "xl/worksheets/sheet2.xml",
      "xl/worksheets/_rels/sheet2.xml.rels",
      "xl/drawings/drawing2.xml",
      "xl/drawings/_rels/drawing2.xml.rels",
      "xl/workbook.xml",
      "[Content_Types].xml",
    ]) {
      expect(a.find((p) => p.name === name)!.data.equals(b.find((p) => p.name === name)!.data)).toBe(true);
    }
  });

  it("dedupes the placeholder icon across both drawings (one shared media part)", () => {
    const parts = buildXlsxParts([makeRow({ index: 1 }), makeRow({ index: 2 })], OPTIONS);
    const media = parts.filter((p) => p.name.startsWith("xl/media/"));
    expect(media.map((m) => m.name)).toEqual(["xl/media/image1.png"]);

    const drawing1 = parts.find((p) => p.name === "xl/drawings/drawing1.xml")!.data.toString("utf8");
    const rels1 = parts.find((p) => p.name === "xl/drawings/_rels/drawing1.xml.rels")!.data.toString("utf8");
    const drawing2 = parts.find((p) => p.name === "xl/drawings/drawing2.xml")!.data.toString("utf8");
    const rels2 = parts.find((p) => p.name === "xl/drawings/_rels/drawing2.xml.rels")!.data.toString("utf8");

    expect(drawing1.match(/<xdr:oneCellAnchor>/g)).toHaveLength(2);
    expect(drawing2.match(/<xdr:oneCellAnchor>/g)).toHaveLength(2);
    expect(rels1.match(/relationships\/image"/g)).toHaveLength(2);
    expect(rels2.match(/relationships\/image"/g)).toHaveLength(2);
    // both drawings reference the same single icon part
    expect(rels1).toContain('Target="../media/image1.png"');
    expect(rels2).toContain('Target="../media/image1.png"');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Edge cases
// ───────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles zero rows: gallery title sheet only, no drawings, no media, no hyperlinks", () => {
    const parts = buildXlsxParts([], OPTIONS);
    const names = parts.map((p) => p.name);
    for (const required of REQUIRED_PARTS) expect(names).toContain(required);
    expect(names).not.toContain("xl/drawings/drawing1.xml");
    expect(names).not.toContain("xl/drawings/drawing2.xml");
    expect(parts.some((p) => p.name.startsWith("xl/media/"))).toBe(false);

    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");
    expect(sheet).not.toContain("<hyperlinks>");
    expect(sheet).not.toContain("<drawing ");
    expect(sheet).toContain('<dimension ref="A1:J2"/>');

    const gallery = parts.find((p) => p.name === "xl/worksheets/sheet2.xml")!.data.toString("utf8");
    expect(gallery).toContain("صور المستندات");
    expect(gallery).toContain('<dimension ref="A1:D1"/>');
    expect(gallery).not.toContain("<hyperlinks>");
    expect(gallery).not.toContain("<drawing ");

    const types = parts.find((p) => p.name === "[Content_Types].xml")!.data.toString("utf8");
    expect(types).not.toContain("image/");
    expect(types).not.toContain('Extension="jpg"');
    expect(types).not.toContain('Extension="png"');
    expect(types).not.toContain('PartName="/xl/drawings/drawing1.xml"');
    expect(types).not.toContain('PartName="/xl/drawings/drawing2.xml"');
  });

  it("escapes user-controlled text inside sheet cells", () => {
    const parts = buildXlsxParts(
      [makeRow({ title: 'فاتورة <b>الكهرباء</b> & "الشحن"' })],
      OPTIONS,
    );
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");
    expect(sheet).not.toContain("<b>الكهرباء</b>");
    expect(sheet).toContain("فاتورة &lt;b&gt;الكهرباء&lt;/b&gt; &amp; &quot;الشحن&quot;");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// End-to-end: buildXlsxBuffer (archiver → real ZIP container)
// ───────────────────────────────────────────────────────────────────────────

describe("buildXlsxBuffer (end-to-end)", () => {
  it("returns a real ZIP whose entries match the planned parts and validate", async () => {
    const rows = [
      makeRow({ index: 1, preview: previewJpg(), entryName: "عقد-توريد.pdf" }),
      makeRow({ index: 2, entryName: "قرار إداري - 2026.pdf" }),
    ];
    const expectedParts = buildXlsxParts(rows, OPTIONS);
    const buffer = await buildXlsxBuffer(rows, OPTIONS);

    expect(buffer.subarray(0, 2).toString("ascii")).toBe("PK");
    const entries = readZipEntries(buffer);
    const byName = new Map(entries.map((e) => [e.name, e.data]));
    expect(entries.map((e) => e.name)).toEqual(expectedParts.map((p) => p.name));

    // media bytes survive the round trip untouched
    for (const part of expectedParts.filter((p) => p.name.startsWith("xl/media/"))) {
      expect(byName.get(part.name)!.equals(part.data)).toBe(true);
    }

    // workbook + both sheets + drawing + rels are intact inside the container
    const sheet = byName.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain("المعاينة");
    expect(sheet).toContain('<hyperlink ref="I4" r:id="rId2"');
    const gallery = byName.get("xl/worksheets/sheet2.xml")!.toString("utf8");
    expect(gallery).toContain("صور المستندات");
    const workbook = byName.get("xl/workbook.xml")!.toString("utf8");
    expect(workbook).toContain('name="كشف المستندات"');
    expect(workbook).toContain('name="صور المستندات"');
    expect(byName.get("xl/drawings/drawing1.xml")!.toString("utf8")).toContain('r:embed="rId1"');
    expect(byName.get("xl/drawings/drawing2.xml")!.toString("utf8")).toContain('<a:hlinkClick r:id="rId3"');
    expect(byName.get("[Content_Types].xml")!.toString("utf8")).toContain("spreadsheetml.sheet.main+xml");

    // the hyperlink targets equal the exact document file names — raw, no decoding
    const rels = byName.get("xl/worksheets/_rels/sheet1.xml.rels")!.toString("utf8");
    const targets = [...rels.matchAll(/Target="([^"]+)" TargetMode="External"/g)].map((m) => m[1]);
    expect(targets).toEqual(["عقد-توريد.pdf", "قرار إداري - 2026.pdf"]);
  });

  it("keeps the icon deduplicated end-to-end (3 placeholders → 1 media part, 3 rels per drawing)", async () => {
    const rows = [makeRow({ index: 1 }), makeRow({ index: 2 }), makeRow({ index: 3 })];
    const buffer = await buildXlsxBuffer(rows, OPTIONS);
    const entries = readZipEntries(buffer);
    const media = entries.filter((e) => e.name.startsWith("xl/media/"));
    expect(media).toHaveLength(1);

    const drawing1 = entries.find((e) => e.name === "xl/drawings/drawing1.xml")!.data.toString("utf8");
    const rels1 = entries.find((e) => e.name === "xl/drawings/_rels/drawing1.xml.rels")!.data.toString("utf8");
    expect(drawing1.match(/<xdr:oneCellAnchor>/g)).toHaveLength(3);
    expect(rels1.match(/relationships\/image"/g)).toHaveLength(3);
    expect(rels1).toContain('Target="../media/image1.png"');

    const drawing2 = entries.find((e) => e.name === "xl/drawings/drawing2.xml")!.data.toString("utf8");
    const rels2 = entries.find((e) => e.name === "xl/drawings/_rels/drawing2.xml.rels")!.data.toString("utf8");
    expect(drawing2.match(/<xdr:oneCellAnchor>/g)).toHaveLength(3);
    expect(drawing2).toContain('<a:hlinkClick r:id="rId4"');
    expect(rels2.match(/relationships\/image"/g)).toHaveLength(3);
    expect(rels2.match(/relationships\/hyperlink"/g)).toHaveLength(3);
    expect(rels2).toContain('Target="../media/image1.png"');
  });
});