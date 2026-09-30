// @vitest-environment node
// Server-side test: touches node:crypto / node:fs / @/db. Under the
// default jsdom environment Vite externalizes those builtins and the file
// fails to collect with `No such built-in module: node:`.
import { describe, it, expect } from "vitest";
import { safeZipEntryName } from "../route";
import { escapeXml, hyperlinkTarget, colLetter, cellRef } from "../xlsx";

// ─── safeZipEntryName ─────────────────────────────────────────────────────

describe("safeZipEntryName", () => {
  const used = () => new Set<string>();
  const doc = (overrides: Partial<{ id: number; originalName: string; fileName: string }> = {}) => ({
    id: 1,
    originalName: "contract.pdf",
    fileName: "contract.pdf",
    ...overrides,
  });

  it("strips directory components (zip-slip defence)", () => {
    expect(safeZipEntryName(doc({ originalName: "../../etc/passwd" }), used())).toBe("passwd");
    expect(safeZipEntryName(doc({ originalName: "C:\\Windows\\system32\\evil.exe" }), used())).toBe("evil.exe");
  });

  it("replaces Windows-invalid and control characters", () => {
    expect(safeZipEntryName(doc({ originalName: 'a:b*c?d<e>f|g' }), used())).toBe("a_b_c_d_e_f_g");
    expect(safeZipEntryName(doc({ originalName: "tab\there" }), used())).toBe("tab_here");
  });

  it("falls back to a deterministic name when the filename is empty", () => {
    expect(safeZipEntryName(doc({ originalName: "", fileName: "" }), used())).toBe("document-1");
  });

  it("disambiguates duplicate names with the document id", () => {
    const names = new Set<string>();
    const first = safeZipEntryName(doc({ id: 1, originalName: "report.pdf" }), names);
    const second = safeZipEntryName(doc({ id: 2, originalName: "report.pdf" }), names);
    expect(first).toBe("report.pdf");
    expect(second).toBe("report-2.pdf");
  });

  it("never yields a name that escapes the archive root", () => {
    for (const evil of ["../x", "..\\x", "a/../../b", "/abs/path", "....//x"]) {
      const name = safeZipEntryName(doc({ originalName: evil }), used());
      expect(name).not.toMatch(/\.\./);
      expect(name).not.toMatch(/[\\/]/);
    }
  });
});

// ─── escapeXml ────────────────────────────────────────────────────────────

describe("escapeXml", () => {
  it("escapes all five XML metacharacters", () => {
    expect(escapeXml(`a<b>&"c'`)).toBe("a&lt;b&gt;&amp;&quot;c&apos;");
  });

  it("keeps Arabic text and common punctuation intact", () => {
    expect(escapeXml("قرار إداري — 2026/08 (مشروع)")).toBe("قرار إداري — 2026/08 (مشروع)");
  });

  it("strips control characters that are illegal in XML 1.0", () => {
    expect(escapeXml("a\u0000b\u0007c\u001Fd")).toBe("abcd");
    expect(escapeXml("a\tb\nc\rd")).toBe("a\tb\nc\rd");
  });
});

// ─── hyperlinkTarget ──────────────────────────────────────────────────────

describe("hyperlinkTarget", () => {
  it("keeps spaces, Arabic and every non-# character raw (Excel does not percent-decode relative targets)", () => {
    // A percent-encoded target would be looked up as a file literally named
    // "%D9%82%D8%B1%D8%A7%D8%B1..." → the link breaks. Raw is the only form
    // that resolves to the actual sibling file.
    expect(hyperlinkTarget("قرار إداري - 2026.pdf")).toBe("قرار إداري - 2026.pdf");
    expect(hyperlinkTarget("قرار إداري - 2026.pdf")).not.toContain("%20");
    expect(hyperlinkTarget("قرار إداري - 2026.pdf")).not.toContain("%D8%");
    expect(hyperlinkTarget("فاتورة (شهر 8).xlsx")).toBe("فاتورة (شهر 8).xlsx");
    expect(hyperlinkTarget("100%.pdf")).toBe("100%.pdf"); // a literal % stays raw
  });

  it("encodes only the URI fragment delimiter # (%23) and keeps ? raw", () => {
    // # would be parsed as the start of a URI fragment, truncating the path.
    expect(hyperlinkTarget("عقد#خاص.pdf")).toBe("عقد%23خاص.pdf");
    expect(hyperlinkTarget("مذكرة#سرية.doc")).toBe("مذكرة%23سرية.doc");
    expect(hyperlinkTarget("عقد#خاص؟.pdf")).toBe("عقد%23خاص؟.pdf");
    // ? can never appear (route sanitizer replaces it with _) and raw is safe
    expect(hyperlinkTarget("a?b.pdf")).toBe("a?b.pdf");
    expect(hyperlinkTarget("report.pdf")).toBe("report.pdf");
  });

  it("equals the exact ZIP entry name (link ↔ archive contract, no decoding needed)", () => {
    for (const name of ["عقد-توريد.pdf", "قرار إداري - 2026.pdf", "فاتورة (شهر 8).xlsx", "تقرير-9.pdf"]) {
      expect(hyperlinkTarget(name)).toBe(name);
    }
  });

  it("handles duplicate-safe names (id suffix) identically to the archive entry", () => {
    const names = new Set<string>();
    const entry = safeZipEntryName({ id: 7, originalName: "تقرير.pdf", fileName: "تقرير.pdf" }, names);
    const dup = safeZipEntryName({ id: 9, originalName: "تقرير.pdf", fileName: "تقرير.pdf" }, names);
    expect(hyperlinkTarget(entry)).toBe(entry);
    expect(hyperlinkTarget(dup)).toBe(dup);
    expect(dup).toBe("تقرير-9.pdf");
  });
});

// ─── colLetter / cellRef ──────────────────────────────────────────────────

describe("colLetter", () => {
  it("maps 0-based indices to Excel column letters", () => {
    expect(colLetter(0)).toBe("A");
    expect(colLetter(8)).toBe("I");
    expect(colLetter(9)).toBe("J");
    expect(colLetter(25)).toBe("Z");
    expect(colLetter(26)).toBe("AA");
  });
});

describe("cellRef", () => {
  it("combines column letter with a 1-based row number", () => {
    expect(cellRef(8, 3)).toBe("I3");
    expect(cellRef(9, 10)).toBe("J10");
    expect(cellRef(0, 1)).toBe("A1");
  });
});