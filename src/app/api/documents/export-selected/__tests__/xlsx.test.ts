import { describe, it, expect } from "vitest";
import { inflateRawSync } from "node:zlib";
import {
  buildXlsxBuffer,
  buildXlsxParts,
  buildPlaceholderPng,
  hyperlinkTarget,
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

    expect(sheet).toContain('<dimension ref="A1:J5"/>'); // +1 totals footer row (COUNT/SUM)
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
    expect(drawing.match(/<xdr:twoCellAnchor editAs="oneCell">/g)).toHaveLength(3);
    expect(rels.match(/relationships\/image"/g)).toHaveLength(3);
    expect(rels).toContain('Target="../media/image1.png"');
    expect(rels).toContain('Target="../media/image2.jpg"');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Hyperlinks — the link ↔ archive contract
// ───────────────────────────────────────────────────────────────────────────

describe("hyperlinks", () => {
  it("declares an external hyperlink per row with the relative documents path as target", () => {
    const parts = buildXlsxParts([makeRow({ entryName: "قرار إداري - 2026.pdf" })], OPTIONS);
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/worksheets/_rels/sheet1.xml.rels")!.data.toString("utf8");

    expect(sheet).toContain('<hyperlink ref="I3" r:id="rId1" tooltip="فتح الملف داخل الحزمة"/>');
    expect(rels).toContain('TargetMode="External"');
    // Excel does NOT percent-decode relative external targets — the target
    // must be the literal path relative to the manifest folder (see hyperlinkTarget).
    expect(rels).toContain('Target="../documents/قرار إداري - 2026.pdf" TargetMode="External"');
    expect(rels).not.toContain("%20");
    expect(rels).not.toContain("%D8%");
    // display text keeps the raw file name
    expect(sheet).toContain("<t xml:space=\"preserve\">قرار إداري - 2026.pdf</t>");
  });

  it("every hyperlink target equals the relative documents path (raw, no percent-decoding)", () => {
    const names = ["عقد-توريد.pdf", "قرار إداري - 2026.pdf", "فاتورة (شهر 8).xlsx", "مذكرة#سرية?.doc"];
    const parts = buildXlsxParts(
      names.map((entryName, i) => makeRow({ index: i + 1, entryName })),
      OPTIONS,
    );
    const rels = parts.find((p) => p.name === "xl/worksheets/_rels/sheet1.xml.rels")!.data.toString("utf8");
    const targets = [...rels.matchAll(/Target="([^"]+)" TargetMode="External"/g)].map((m) => m[1]);
    // raw equality — only the URI fragment delimiter # is escaped (%23)
    expect(targets).toEqual([
      "../documents/عقد-توريد.pdf",
      "../documents/قرار إداري - 2026.pdf",
      "../documents/فاتورة (شهر 8).xlsx",
      "../documents/مذكرة%23سرية?.doc",
    ]);
  });

  it("file cell carries an external hyperlink rel matching the raw entryName", () => {
    const entryName = "تقرير متابعة & مراجعة #2.pdf";
    const parts = buildXlsxParts([makeRow({ entryName })], OPTIONS);
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");
    const rels = parts.find((p) => p.name === "xl/worksheets/_rels/sheet1.xml.rels")!.data.toString("utf8");
    // display text is the raw file name (XML-escaped), hyperlink target is raw + #→%23
    expect(sheet).toContain('<c r="I3" s="6" t="inlineStr">'); // first data row uses alt hyperlink style
    expect(sheet).toContain('<hyperlink ref="I3" r:id="rId1"');
    expect(rels).toContain('Target="../documents/تقرير متابعة &amp; مراجعة %232.pdf" TargetMode="External"');
    expect(rels).not.toContain("%D8%");
    expect(rels).not.toContain("%20");
  });

  it("adds AutoFilter, frozen pane, totals footer and landscape fit-to-page print setup", () => {
    const parts = buildXlsxParts([makeRow({ index: 1 }), makeRow({ index: 2 })], OPTIONS);
    const sheet = parts.find((p) => p.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");
    expect(sheet).toContain('<autoFilter ref="A2:J4"/>');
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain("الإجمالي — 2 مستند");
    expect(sheet).toContain("<f>SUM(H3:H4)</f>");
    expect(sheet).toContain('orientation="landscape"');
    expect(sheet).toContain('fitToPage="1"');
  });

  it("emits an EDMS cover sheet with counts, totals and status/department summaries", () => {
    const parts = buildXlsxParts(
      [makeRow({ status: "ساري" }), makeRow({ status: "منتهي", departmentName: "المالية" })],
      OPTIONS,
    );
    const names = parts.map((p) => p.name);
    expect(names).toContain("xl/worksheets/sheet3.xml");
    const workbook = parts.find((p) => p.name === "xl/workbook.xml")!.data.toString("utf8");
    expect(workbook).toContain('name="الغلاف" sheetId="3" r:id="rId4"');
    const cover = parts.find((p) => p.name === "xl/worksheets/sheet3.xml")!.data.toString("utf8");
    expect(cover).toContain("EDMS ◆");
    expect(cover).toContain("ملخص حسب الحالة");
    expect(cover).toContain("ملخص حسب القسم");
    expect(cover).toContain('rightToLeft="1"');
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
    // twoCellAnchor repair guard: explicit editAs + from/to, no bare ext child
    expect(drawing).toContain('<xdr:twoCellAnchor editAs="oneCell">');
    expect(drawing).not.toContain("<xdr:oneCellAnchor>");
    expect(drawing).not.toContain("<xdr:ext ");
    // `to` reuses the from cell with start-offset + 64px size (762000 / 635000)
    expect(drawing).toContain("<xdr:to><xdr:col>9</xdr:col><xdr:colOff>762000</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>635000</xdr:rowOff></xdr:to>");
    expect(drawing).toContain(`<a:ext cx="609600" cy="609600"/>`);
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
// Drawing repair guard (ECMA-376 CT_TwoCellAnchor): every anchor carries
// editAs="oneCell" + from/to in schema order, every r:embed / hlinkClick
// r:id resolves to a drawing rel, and every image rel target exists as a
// media part. Fails on any future regression that makes Excel emit
// "repaired parts: drawing1.xml / drawing2.xml".
// ───────────────────────────────────────────────────────────────────────────

describe("drawing repair guard (twoCellAnchor + rels consistency)", () => {
  function xmlOf(parts: { name: string; data: Buffer }[], name: string): string {
    return parts.find((p) => p.name === name)!.data.toString("utf8");
  }

  it("uses twoCellAnchor editAs=oneCell with from/to on every anchor, in schema order", () => {
    const rows = [
      makeRow({ index: 1, preview: previewJpg() }),
      makeRow({ index: 2 }),
      makeRow({ index: 3, preview: previewPng() }),
    ];
    const parts = buildXlsxParts(rows, OPTIONS);
    for (const name of ["xl/drawings/drawing1.xml", "xl/drawings/drawing2.xml"]) {
      const drawing = xmlOf(parts, name);
      expect(drawing).not.toContain("oneCellAnchor");
      const anchors = [...drawing.matchAll(/<xdr:twoCellAnchor editAs="oneCell">([\s\S]*?)<\/xdr:twoCellAnchor>/g)];
      expect(anchors).toHaveLength(3);
      for (const [, body] of anchors) {
        const from = body.indexOf("<xdr:from>");
        const to = body.indexOf("<xdr:to>");
        const pic = body.indexOf("<xdr:pic>");
        const client = body.indexOf("<xdr:clientData/>");
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeGreaterThan(from);
        expect(pic).toBeGreaterThan(to);
        expect(client).toBeGreaterThan(pic);
      }
    }
  });

  it("every r:embed and hlinkClick r:id resolves to a drawing rel whose target exists", () => {
    const rows = [
      makeRow({ index: 1, preview: previewJpg(), entryName: "عقد-توريد.pdf" }),
      makeRow({ index: 2, entryName: "قرار إداري - 2026.pdf" }),
    ];
    const parts = buildXlsxParts(rows, OPTIONS);
    const mediaNames = parts.filter((p) => p.name.startsWith("xl/media/")).map((p) => p.name);
    const pairs: Array<[string, string]> = [
      ["xl/drawings/drawing1.xml", "xl/drawings/_rels/drawing1.xml.rels"],
      ["xl/drawings/drawing2.xml", "xl/drawings/_rels/drawing2.xml.rels"],
    ];
    for (const [drawingName, relsName] of pairs) {
      const drawing = xmlOf(parts, drawingName);
      const rels = xmlOf(parts, relsName);
      for (const id of [...drawing.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1])) {
        const target = rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`))?.[1];
        expect(target, `${drawingName} embed ${id}`).toBeTruthy();
        expect(mediaNames, `${drawingName} embed ${id} target`).toContain(`xl/${target!.slice(3)}`);
      }
      for (const id of [...drawing.matchAll(/hlinkClick r:id="([^"]+)"/g)].map((m) => m[1])) {
        expect(rels, `${drawingName} hlinkClick ${id}`).toContain(`Id="${id}"`);
        expect(rels).toContain(`Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"`);
      }
      // cNvPr ids are unique within the drawing (duplicates trigger repair)
      const ids = [...drawing.matchAll(/<xdr:cNvPr id="(\d+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("shared placeholder icon resolves from both drawings to the single media part", () => {
    const parts = buildXlsxParts([makeRow({ index: 1 }), makeRow({ index: 2 })], OPTIONS);
    expect(parts.filter((p) => p.name.startsWith("xl/media/")).map((m) => m.name)).toEqual([
      "xl/media/image1.png",
    ]);
    for (const relsName of [
      "xl/drawings/_rels/drawing1.xml.rels",
      "xl/drawings/_rels/drawing2.xml.rels",
    ]) {
      const rels = xmlOf(parts, relsName);
      for (const target of [...rels.matchAll(/relationships\/image" Target="([^"]+)"/g)].map((m) => m[1])) {
        expect(parts.some((p) => p.name === `xl/${target.slice(3)}`), `${relsName} ${target}`).toBe(true);
      }
    }
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
    expect(rels).toContain('Target="../documents/عقد-توريد.pdf" TargetMode="External"');
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
    expect(drawing).toContain(`<a:ext cx="1428750" cy="1047750"/>`);
    expect(drawing).toContain("<xdr:colOff>109538</xdr:colOff>");
    expect(drawing).toContain("<xdr:rowOff>98425</xdr:rowOff>");
    // twoCellAnchor repair guard: explicit editAs + from/to (same cell, offset + size)
    expect(drawing).toContain('<xdr:twoCellAnchor editAs="oneCell">');
    expect(drawing).not.toContain("<xdr:oneCellAnchor>");
    expect(drawing).not.toContain("<xdr:ext ");
    expect(drawing).toContain("<xdr:to><xdr:col>0</xdr:col><xdr:colOff>1538288</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>1146175</xdr:rowOff></xdr:to>");
    // 1pt thin border around the picture
    expect(drawing).toContain('<a:ln w="12700"><a:solidFill><a:srgbClr val="FFCBD5E1"/></a:solidFill></a:ln>');
    // image click opens the file (hyperlink rel lives after the image rels)
    expect(drawing).toContain('<a:hlinkClick r:id="rId2" tooltip="فتح الملف داخل الحزمة"/>');
    expect(rels).toContain('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>');
    expect(rels).toContain('<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="../documents/عقد-توريد.pdf" TargetMode="External"/>');
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
      expect(rels).toContain(`relationships/hyperlink" Target="../documents/${name}" TargetMode="External"`);
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

    expect(drawing1.match(/<xdr:twoCellAnchor editAs="oneCell">/g)).toHaveLength(2);
    expect(drawing2.match(/<xdr:twoCellAnchor editAs="oneCell">/g)).toHaveLength(2);
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

    // the hyperlink targets equal the relative documents paths — raw, no decoding
    const rels = byName.get("xl/worksheets/_rels/sheet1.xml.rels")!.toString("utf8");
    const targets = [...rels.matchAll(/Target="([^"]+)" TargetMode="External"/g)].map((m) => m[1]);
    expect(targets).toEqual(["../documents/عقد-توريد.pdf", "../documents/قرار إداري - 2026.pdf"]);
  });

  it("keeps the icon deduplicated end-to-end (3 placeholders → 1 media part, 3 rels per drawing)", async () => {
    const rows = [makeRow({ index: 1 }), makeRow({ index: 2 }), makeRow({ index: 3 })];
    const buffer = await buildXlsxBuffer(rows, OPTIONS);
    const entries = readZipEntries(buffer);
    const media = entries.filter((e) => e.name.startsWith("xl/media/"));
    expect(media).toHaveLength(1);

    const drawing1 = entries.find((e) => e.name === "xl/drawings/drawing1.xml")!.data.toString("utf8");
    const rels1 = entries.find((e) => e.name === "xl/drawings/_rels/drawing1.xml.rels")!.data.toString("utf8");
    expect(drawing1.match(/<xdr:twoCellAnchor editAs="oneCell">/g)).toHaveLength(3);
    expect(rels1.match(/relationships\/image"/g)).toHaveLength(3);
    expect(rels1).toContain('Target="../media/image1.png"');

    const drawing2 = entries.find((e) => e.name === "xl/drawings/drawing2.xml")!.data.toString("utf8");
    const rels2 = entries.find((e) => e.name === "xl/drawings/_rels/drawing2.xml.rels")!.data.toString("utf8");
    expect(drawing2.match(/<xdr:twoCellAnchor editAs="oneCell">/g)).toHaveLength(3);
    expect(drawing2).toContain('<a:hlinkClick r:id="rId4"');
    expect(rels2.match(/relationships\/image"/g)).toHaveLength(3);
    expect(rels2.match(/relationships\/hyperlink"/g)).toHaveLength(3);
    expect(rels2).toContain('Target="../media/image1.png"');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ZIP layout contract: report/كشف-المستندات.xlsx + documents/<file>
// ───────────────────────────────────────────────────────────────────────────

describe("zip layout contract (report/ + documents/)", () => {
  it("hyperlinkTarget builds a relative path from the manifest folder: raw unicode, #→%23 only", () => {
    expect(hyperlinkTarget("عقد توريد.pdf", "../documents/")).toBe("../documents/عقد توريد.pdf");
    expect(hyperlinkTarget("مذكرة#سرية.pdf", "../documents/")).toBe("../documents/مذكرة%23سرية.pdf");
    // & stays raw here — the caller applies escapeXml for the XML attribute
    expect(hyperlinkTarget("تقرير & مراجعة.pdf", "../documents/")).toBe("../documents/تقرير & مراجعة.pdf");
    // no basePath keeps the legacy bare-name behaviour
    expect(hyperlinkTarget("عقد-توريد.pdf")).toBe("عقد-توريد.pdf");
  });

  it("every hyperlink rel (sheet1/sheet2/drawing hlinkClick) matches the relative documents path", () => {
    const names = ["عقد-توريد.pdf", "قرار إداري - 2026.pdf", "مذكرة#سرية?.doc"];
    const rows = names.map((entryName, i) => makeRow({ index: i + 1, entryName }));
    const parts = buildXlsxParts(rows, OPTIONS);
    const xmlOf = (n: string) => parts.find((p) => p.name === n)!.data.toString("utf8");
    const expected = [
      "../documents/عقد-توريد.pdf",
      "../documents/قرار إداري - 2026.pdf",
      "../documents/مذكرة%23سرية?.doc",
    ];
    const sheet1 = [...xmlOf("xl/worksheets/_rels/sheet1.xml.rels").matchAll(/Target="([^"]+)" TargetMode="External"/g)].map((m) => m[1]);
    const sheet2 = [...xmlOf("xl/worksheets/_rels/sheet2.xml.rels").matchAll(/Target="([^"]+)" TargetMode="External"/g)].map((m) => m[1]);
    const drawingHlinks = [...xmlOf("xl/drawings/_rels/drawing2.xml.rels").matchAll(/relationships\/hyperlink" Target="([^"]+)" TargetMode="External"/g)].map((m) => m[1]);
    expect(sheet1).toEqual(expected);
    expect(sheet2).toEqual(expected);
    expect(drawingHlinks).toEqual(expected);
    // hlinkClick ids in drawing2 point at those hyperlink rels (rIdN+1..rId2N)
    const drawing = xmlOf("xl/drawings/drawing2.xml");
    const rels2 = xmlOf("xl/drawings/_rels/drawing2.xml.rels");
    const hlinks = [...drawing.matchAll(/hlinkClick r:id="([^"]+)"/g)].map((m) => m[1]);
    expect(hlinks).toEqual(["rId4", "rId5", "rId6"]);
    for (const id of hlinks) expect(rels2).toContain(`Id="${id}"`);
  });

  it("the manifest opens: sheet1/2/3 + rels + contentTypes are mutually consistent", () => {
    const parts = buildXlsxParts([makeRow({ index: 1 })], OPTIONS);
    const xmlOf = (n: string) => parts.find((p) => p.name === n)!.data.toString("utf8");
    const workbook = xmlOf("xl/workbook.xml");
    const wbRels = xmlOf("xl/_rels/workbook.xml.rels");
    const types = xmlOf("[Content_Types].xml");
    expect(workbook).toContain('name="الغلاف" sheetId="3" r:id="rId4"');
    expect(wbRels).toContain('Id="rId4"');
    expect(wbRels).toContain('Target="worksheets/sheet3.xml"');
    expect(types).toContain('PartName="/xl/worksheets/sheet3.xml"');
    for (const s of ["xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "xl/worksheets/sheet3.xml"]) {
      expect(xmlOf(s)).toContain("<dimension ref=");
      expect(xmlOf(s)).toContain("<sheetData>");
    }
    // sheet1 keeps dimension/autofilter/footer/print; the cover needs no rels part
    expect(xmlOf("xl/worksheets/sheet1.xml")).toContain("<autoFilter");
    expect(xmlOf("xl/worksheets/sheet1.xml")).toContain("<f>SUM(");
    expect(xmlOf("xl/worksheets/sheet1.xml")).toContain('orientation="landscape"');
    expect(parts.some((p) => p.name === "xl/worksheets/_rels/sheet3.xml.rels")).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// OOXML repair guard: worksheet child order (ECMA-376 CT_Worksheet) +
// merged-range cell presence + caption newline hygiene. Fails on any future
// reorder that makes Excel emit "repaired parts" for sheet1/2/3.
// ───────────────────────────────────────────────────────────────────────────

describe("worksheet repair guard (ECMA-376 order)", () => {
  const ORDER = [
    "<sheetPr",
    "<dimension",
    "<sheetViews",
    "<cols",
    "<sheetData",
    "<autoFilter",
    "<mergeCells",
    "<hyperlinks",
    "<printOptions",
    "<pageMargins",
    "<pageSetup",
    "<drawing",
  ];

  function expectSchemaOrder(xml: string, label: string): void {
    let prev = -1;
    for (const tag of ORDER) {
      const idx = xml.indexOf(tag);
      if (idx === -1) continue; // optional child absent — nothing to order
      expect(idx, `${label}: ${tag} out of schema sequence`).toBeGreaterThan(prev);
      prev = idx;
    }
  }

  function xmlOf(parts: { name: string; data: Buffer }[], name: string): string {
    return parts.find((p) => p.name === name)!.data.toString("utf8");
  }

  it("keeps sheet1/sheet2/sheet3 children in schema sequence (with and without rows)", () => {
    const cases: XlsxDocRow[][] = [
      [makeRow({ index: 1, preview: previewPng() }), makeRow({ index: 2 })],
      [],
    ];
    for (const rows of cases) {
      const parts = buildXlsxParts(rows, OPTIONS);
      for (const name of [
        "xl/worksheets/sheet1.xml",
        "xl/worksheets/sheet2.xml",
        "xl/worksheets/sheet3.xml",
      ]) {
        expectSchemaOrder(xmlOf(parts, name), `${name} (${rows.length} rows)`);
      }
    }
  });

  it("every merged range has all of its cells present", () => {
    const parts = buildXlsxParts([makeRow({ index: 1 })], OPTIONS);
    const sheet1 = xmlOf(parts, "xl/worksheets/sheet1.xml");
    for (const ref of ["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1", "I1", "J1"]) {
      expect(sheet1, `sheet1 ${ref}`).toContain(`<c r="${ref}"`);
    }
    const gallery = xmlOf(parts, "xl/worksheets/sheet2.xml");
    for (const ref of ["A1", "B1", "C1", "D1"]) {
      expect(gallery, `sheet2 ${ref}`).toContain(`<c r="${ref}"`);
    }
    const cover = xmlOf(parts, "xl/worksheets/sheet3.xml");
    for (const ref of ["A1", "B1", "C1", "D1"]) {
      expect(cover, `sheet3 ${ref}`).toContain(`<c r="${ref}"`);
    }
    // cover section merges (A{rr}:D{rr}) — every merged row keeps all 4 cells
    for (const m of cover.matchAll(/<mergeCell ref="A(\d+):D\d+"\/>/g)) {
      const r = m[1];
      for (const col of ["A", "B", "C", "D"]) {
        expect(cover, `sheet3 ${col}${r}`).toContain(`<c r="${col}${r}"`);
      }
    }
  });

  it("gallery captions preserve newlines and strip illegal controls", () => {
    const bell = String.fromCharCode(7);
    const parts = buildXlsxParts(
      [makeRow({ index: 1, title: "line1\nline2" + bell + "tail" })],
      OPTIONS,
    );
    const gallery = xmlOf(parts, "xl/worksheets/sheet2.xml");
    const caption = gallery.match(/<c r="A3"[^>]*>[\s\S]*?<\/c>/)?.[0] ?? "";
    // LF survives inside <t xml:space="preserve"> (wrapText shows the break),
    // while the illegal BEL control is stripped by escapeXml.
    expect(caption).toContain("line1\nline2tail");
    expect(gallery).not.toContain(bell);
    // no C0 control (other than tab/LF/CR) may leak into any sheet part
    for (const name of [
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
      "xl/worksheets/sheet3.xml",
    ]) {
      const xml = xmlOf(parts, name);
      for (let i = 0; i < xml.length; i += 1) {
        const c = xml.charCodeAt(i);
        expect(c < 32 && c !== 9 && c !== 10 && c !== 13, `${name} offset ${i}`).toBe(false);
      }
    }
  });
});