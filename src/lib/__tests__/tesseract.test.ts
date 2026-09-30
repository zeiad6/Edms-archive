// @vitest-environment node
// Server-side test: touches node:crypto / node:fs / @/db. Under the
// default jsdom environment Vite externalizes those builtins and the file
// fails to collect with `No such built-in module: node:`.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { findTesseract, resolveTesseract, runTesseractOcr, type TessDeps } from "@/lib/tesseract";

// --- test doubles ----------------------------------------------------------
// The module exposes injectable seams (TessDeps) instead of module mocking —
// vitest 4 does not apply vi.mock of node: builtins to OTHER modules in the
// graph (only to the test file's own imports), so this is the deterministic
// approach. Real node:fs / node:child_process are never touched.

const NO_EXE = () => false;

function execSuccess(stdout: string): NonNullable<TessDeps["execFile"]> {
  return async () => ({ stdout });
}

function execFailure(message: string): NonNullable<TessDeps["execFile"]> {
  return async () => {
    throw new Error(message);
  };
}

function bundledEnginePaths(resourcesPath: string) {
  return {
    exe: path.join(resourcesPath, "tesseract", "tesseract.exe"),
    tessdata: path.join(resourcesPath, "tesseract", "tessdata"),
  };
}

beforeEach(() => {
  delete process.env.TESSERACT_PATH;
});

afterEach(() => {
  delete process.env.TESSERACT_PATH;
});

describe("resolveTesseract — engine resolution order", () => {
  it("prefers TESSERACT_PATH when it points at an existing file", () => {
    const envExe = "C:\\custom\\tesseract.exe";
    process.env.TESSERACT_PATH = envExe;

    expect(resolveTesseract({ existsSync: (f) => f === envExe })).toEqual({ exe: envExe });
  });

  it("falls through a STALE TESSERACT_PATH to the bundled engine", () => {
    const resourcesPath = "E:\\app\\resources";
    process.env.TESSERACT_PATH = "C:\\gone\\tesseract.exe";
    const { exe, tessdata } = bundledEnginePaths(resourcesPath);

    expect(
      resolveTesseract({ resourcesPath, existsSync: (f) => f === resourcesPath || f === exe })
    ).toEqual({ exe, tessdataDir: tessdata });
  });

  it("uses the bundled engine inside a packaged app (process.resourcesPath)", () => {
    const resourcesPath = "E:\\app\\resources";
    const { exe, tessdata } = bundledEnginePaths(resourcesPath);

    expect(
      resolveTesseract({ resourcesPath, existsSync: (f) => f === resourcesPath || f === exe })
    ).toEqual({ exe, tessdataDir: tessdata });
  });

  it("defaults resourcesPath to the real process.resourcesPath when no override is given", () => {
    // No override -> resolveBundledEngine reads the REAL (packaged-app) path;
    // in plain Node it is undefined, so the lookup is skipped and the machine
    // fallback wins — no throw, no accidental bundled resolution.
    const machineExe = "E:\\Program Files\\Tesseract-OCR\\tesseract.exe";
    expect(
      resolveTesseract({
        existsSync: (f) => f === machineExe,
        resourcesPath: undefined,
      })
    ).toEqual({ exe: machineExe });
  });

  it("falls back to machine-install locations (dev machines)", () => {
    const machineExe = "C:\\Program Files\\Tesseract-OCR\\tesseract.exe";

    expect(resolveTesseract({ existsSync: (f) => f === machineExe })).toEqual({ exe: machineExe });
  });

  it("throws the Arabic error when nothing exists", () => {
    expect(() => resolveTesseract({ existsSync: NO_EXE })).toThrow(
      "تعذر العثور على محرك Tesseract OCR — ثبّته أو اضبط متغير TESSERACT_PATH"
    );
  });

  it("findTesseract keeps the back-compat string contract", () => {
    const machineExe = "C:\\Program Files\\Tesseract-OCR\\tesseract.exe";

    expect(findTesseract({ existsSync: (f) => f === machineExe })).toBe(machineExe);
  });
});

describe("runTesseractOcr — engine invocation", () => {
  const input = path.join(tmpdir(), `edms-ocr-test-${Date.now()}.txt`);

  beforeEach(() => {
    writeFileSync(input, "dummy input that is NOT a raster — sharp is skipped");
  });
  afterEach(() => {
    rmSync(input, { force: true });
  });

  it("passes --tessdata-dir and TESSDATA_PREFIX when running the BUNDLED engine", async () => {
    const resourcesPath = "E:\\app\\resources";
    const { exe, tessdata } = bundledEnginePaths(resourcesPath);
    let captured: { cmd: string; args: string[]; env: NodeJS.ProcessEnv } | undefined;
    const execFile: NonNullable<TessDeps["execFile"]> = async (cmd, args, opts) => {
      captured = { cmd, args, env: opts.env };
      return { stdout: "نص مستخرج من الصورة" };
    };

    const text = await runTesseractOcr(input, {
      resourcesPath,
      existsSync: (f) => f === resourcesPath || f === exe,
      execFile,
    });

    expect(text).toBe("نص مستخرج من الصورة");
    expect(captured).toBeDefined();
    expect(captured!.cmd).toBe(exe);
    expect(captured!.args).toContain("--tessdata-dir");
    expect(captured!.args).toContain(tessdata);
    expect(captured!.args).toContain("-l");
    expect(captured!.args).toContain("ara+eng");
    expect(captured!.args[captured!.args.length - 1]).toBe("stdout");
    expect(captured!.env.TESSDATA_PREFIX).toBe(tessdata);
  });

  it("passes NO tessdata args when running a machine engine", async () => {
    const machineExe = "E:\\Program Files\\Tesseract-OCR\\tesseract.exe";
    let captured: { args: string[] } | undefined;
    const execFile: NonNullable<TessDeps["execFile"]> = async (_cmd, args) => {
      captured = { args };
      return { stdout: "ok" };
    };

    await runTesseractOcr(input, {
      existsSync: (f) => f === machineExe,
      execFile,
    });

    expect(captured).toBeDefined();
    expect(captured!.args).not.toContain("--tessdata-dir");
  });

  it("rejects with the Arabic error when no engine exists", async () => {
    await expect(
      runTesseractOcr(input, { existsSync: NO_EXE, execFile: execSuccess("x") })
    ).rejects.toThrow("تعذر العثور على محرك Tesseract OCR — ثبّته أو اضبط متغير TESSERACT_PATH");
  });

  it("propagates OCR failures", async () => {
    const machineExe = "E:\\Program Files\\Tesseract-OCR\\tesseract.exe";
    await expect(
      runTesseractOcr(input, {
        existsSync: (f) => f === machineExe,
        execFile: execFailure("tesseract failed"),
      })
    ).rejects.toThrow("tesseract failed");
  });

  it("cleans up the preprocessed temp file when OCR fails", async () => {
    const resourcesPath = "E:\\app\\resources";
    const { exe } = bundledEnginePaths(resourcesPath);
    // A real raster: sharp preprocesses it into a temp PNG, then the engine
    // fails — the temp file must be gone afterwards.
    const rasterInput = path.join(tmpdir(), `edms-ocr-test-${Date.now()}.png`);
    // 1x1 transparent PNG (valid, decodable by sharp)
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    writeFileSync(rasterInput, pngBytes);
    try {
      await expect(
        runTesseractOcr(rasterInput, {
          resourcesPath,
          existsSync: (f) => f === resourcesPath || f === exe,
          execFile: execFailure("tesseract failed"),
        })
      ).rejects.toThrow("tesseract failed");

      // The preprocessed temp PNG must have been unlinked; the ORIGINAL
      // input file stays untouched. (sharp's temp files are named
      // edms-ocr-<ts>.png — the "edms-ocr-test-*" files below are this
      // suite's own inputs, which are cleaned by afterEach/finally.)
      const leftovers = readdirSync(tmpdir()).filter(
        (f) => f.startsWith("edms-ocr-") && !f.startsWith("edms-ocr-test-")
      );
      expect(leftovers).toHaveLength(0);
      expect(existsSync(rasterInput)).toBe(true);
    } finally {
      rmSync(rasterInput, { force: true });
    }
  });
});