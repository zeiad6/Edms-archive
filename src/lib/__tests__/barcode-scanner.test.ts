import { describe, it, expect } from "vitest";
import { parseDocumentRefFromBarcode } from "@/lib/barcode-scanner";

describe("parseDocumentRefFromBarcode", () => {
  it("recognizes pure numeric references (6-12 digits)", () => {
    const result = parseDocumentRefFromBarcode("123456");
    expect(result.isValid).toBe(true);
    expect(result.docNumber).toBe("123456");
  });

  it("recognizes 12-digit numeric references", () => {
    const result = parseDocumentRefFromBarcode("123456789012");
    expect(result.isValid).toBe(true);
    expect(result.docNumber).toBe("123456789012");
  });

  it("rejects numeric references shorter than 6 digits", () => {
    const result = parseDocumentRefFromBarcode("12345");
    expect(result.isValid).toBe(false);
  });

  it("rejects numeric references longer than 12 digits", () => {
    const result = parseDocumentRefFromBarcode("1234567890123");
    expect(result.isValid).toBe(false);
  });

  it("recognizes alphanumeric references with dash separator", () => {
    const result = parseDocumentRefFromBarcode("DOC-12345");
    expect(result.isValid).toBe(true);
    expect(result.docNumber).toBe("DOC-12345");
  });

  it("recognizes alphanumeric references with slash separator", () => {
    const result = parseDocumentRefFromBarcode("INV/2024/001");
    expect(result.isValid).toBe(true);
    expect(result.docNumber).toBe("INV/2024/001");
  });

  it("recognizes UUID format references", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = parseDocumentRefFromBarcode(uuid);
    expect(result.isValid).toBe(true);
    expect(result.docNumber).toBe(uuid);
  });

  it("rejects random text that doesn't match any pattern", () => {
    const result = parseDocumentRefFromBarcode("hello world");
    expect(result.isValid).toBe(false);
  });

  it("rejects empty string", () => {
    const result = parseDocumentRefFromBarcode("");
    expect(result.isValid).toBe(false);
  });

  it("handles whitespace by trimming", () => {
    const result = parseDocumentRefFromBarcode("  123456  ");
    expect(result.isValid).toBe(true);
    expect(result.docNumber).toBe("123456");
  });

  it("recognizes short prefix (2 chars) with digits", () => {
    const result = parseDocumentRefFromBarcode("HR-12345");
    expect(result.isValid).toBe(true);
    expect(result.docNumber).toBe("HR-12345");
  });

  it("recognizes long prefix (6 chars) with digits", () => {
    const result = parseDocumentRefFromBarcode("CONTR-12345");
    expect(result.isValid).toBe(true);
    expect(result.docNumber).toBe("CONTR-12345");
  });

  it("rejects prefix with only 1 character", () => {
    const result = parseDocumentRefFromBarcode("A-12345");
    expect(result.isValid).toBe(false);
  });

  it("rejects prefix with more than 6 characters", () => {
    const result = parseDocumentRefFromBarcode("CONTRACTS-12345");
    expect(result.isValid).toBe(false);
  });
});
