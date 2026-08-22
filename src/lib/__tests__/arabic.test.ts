import { describe, it, expect } from "vitest";
import { normalizeArabic, lightStemArabic, tokenizeArabicQuery, normalizeArabicTerm } from "@/lib/arabic";

describe("normalizeArabic", () => {
  it("removes tashkeel (diacritics)", () => {
    expect(normalizeArabic("المُستندات")).toBe("المستندات");
    expect(normalizeArabic("مُحَمَّد")).toBe("محمد");
  });

  it("normalizes alef variants to ا", () => {
    expect(normalizeArabic("إلى")).toBe("الي");
    expect(normalizeArabic("أرشيف")).toBe("ارشيف");
  });

  it("normalizes teh marbuta to heh and alef maqsura to yaa", () => {
    expect(normalizeArabic("مؤسسة")).toBe("موسسه");
    expect(normalizeArabic("مستشفى")).toBe("مستشفي");
  });
});

describe("tokenizeArabicQuery", () => {
  it("drops stopwords", () => {
    expect(tokenizeArabicQuery("من في عن على")).toEqual([]);
  });

  it("stems prefixed/suffixed words to a shared stem", () => {
    expect(tokenizeArabicQuery("المستندات")).toEqual(["مستند"]);
    expect(tokenizeArabicQuery("المستندات المالية")).toEqual(["مستند", "مالي"]);
  });

  it("excludes negation terms from positive terms", () => {
    expect(tokenizeArabicQuery("مستند -المرفوض")).toEqual(["مستند"]);
  });

  it("keeps meaningful words", () => {
    expect(tokenizeArabicQuery("بحث عن المستندات")).toEqual(["بحث", "مستند"]);
  });
});

describe("normalizeArabicTerm", () => {
  it("normalizes and stems a negation term", () => {
    expect(normalizeArabicTerm("المستندات")).toBe("مستند");
    expect(normalizeArabicTerm("المرفوضة")).toBe("مرفوض");
  });
});