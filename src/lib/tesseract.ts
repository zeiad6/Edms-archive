import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

/** Raster formats that sharp can preprocess (PDFs are passed through). */
const RASTER_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp", ".gif"]);

/** Describes a usable Tesseract engine. */
export interface TessEngine {
  /** Absolute path to tesseract.exe. */
  exe: string;
  /**
   * Absolute path to the tessdata directory, set ONLY for the bundled engine
   * packaged inside the app (resources/tesseract/tessdata). The OCR run then
   * passes `--tessdata-dir` and TESSDATA_PREFIX explicitly.
   */
  tessdataDir?: string;
}

/**
 * Injectable seams (tests). When omitted, real node:fs / node:child_process
 * and the real process.resourcesPath are used.
 */
export interface TessDeps {
  /** existsSync replacement (defaults to the real node:fs one). */
  existsSync?: (p: string) => boolean;
  /**
   * Overrides the packaged-app resources dir. Defaults to
   * `process.resourcesPath` (only present inside a packaged Electron app).
   */
  resourcesPath?: string;
  /** execFile replacement (defaults to promisified node:child_process.execFile). */
  execFile?: (
    cmd: string,
    args: string[],
    opts: { maxBuffer: number; timeout: number; windowsHide: boolean; env: NodeJS.ProcessEnv }
  ) => Promise<{ stdout: string }>;
}

/** Legacy machine-install locations, tried after the bundled engine. */
const MACHINE_CANDIDATES = [
  "E:\\Program Files\\Tesseract-OCR\\tesseract.exe",
  "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
  "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
];

/**
 * Locates the Tesseract OCR engine (v5.x) the app actually ships with.
 *
 * Resolution order:
 *   1. TESSERACT_SRC env var (explicit override; file or directory — a stale
 *      value falls through, same as before).
 *   2. TESSERACT_PATH env var (back-compat alias; must point at an existing
 *      file — a stale value falls through, same as before).
 *   3. The BUNDLED engine — resources/tesseract/tesseract.exe next to the
 *      app. `process.resourcesPath` only exists in a packaged Electron app,
 *      so in plain Node (dev, tests) this candidate is skipped entirely.
 *      This is what makes the packaged app self-contained: no external
 *      Tesseract install is needed on target machines.
 *   4. PATH lookup — first `tesseract(.exe)` found in %PATH% directories.
 *   5. Old machine-install locations (dev machines / manual installs) as
 *      last resort.
 *
 * Throws the same Arabic error as before when nothing is found.
 */
export function resolveTesseract(deps: TessDeps = {}): TessEngine {
  const exists = deps.existsSync ?? existsSync;

  const srcPath = resolveEnvCandidate(process.env.TESSERACT_SRC, exists);
  if (srcPath) return { exe: srcPath };

  const envPath = process.env.TESSERACT_PATH;
  if (envPath && exists(envPath)) return { exe: envPath };

  const bundled = resolveBundledEngine(deps);
  if (bundled) return bundled;

  const onPath = resolveFromPath(exists);
  if (onPath) return { exe: onPath };

  for (const p of MACHINE_CANDIDATES) {
    if (exists(p)) return { exe: p };
  }
  throw new Error("تعذر العثور على محرك Tesseract OCR — ثبّته أو اضبط متغير TESSERACT_PATH");
}

/** TESSERACT_SRC accepts a file or a directory containing tesseract.exe. */
function resolveEnvCandidate(src: string | undefined, exists: (p: string) => boolean): string | null {
  if (!src) return null;
  if (exists(src)) {
    if (src.toLowerCase().endsWith(".exe")) return src;
    const asFile = path.join(src, "tesseract.exe");
    if (exists(asFile)) return asFile;
    return src; // existing custom path — let execFile resolve it
  }
  const asFile = src.toLowerCase().endsWith(".exe") ? src : path.join(src, "tesseract.exe");
  return exists(asFile) ? asFile : null;
}

/** Search %PATH% directories for tesseract.exe / tesseract. */
function resolveFromPath(exists: (p: string) => boolean): string | null {
  const pathEnv = process.env.PATH || process.env.Path || "";
  if (!pathEnv) return null;
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of ["tesseract.exe", "tesseract"]) {
      const candidate = path.join(dir, name);
      try {
        if (exists(candidate)) return candidate;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** Bundled engine shipped inside the packaged app (resources/tesseract). */
function resolveBundledEngine(deps: TessDeps): TessEngine | null {
  const exists = deps.existsSync ?? existsSync;
  const resourcesPath =
    deps.resourcesPath !== undefined
      ? deps.resourcesPath
      : (process as { resourcesPath?: string }).resourcesPath;
  if (!resourcesPath || !exists(resourcesPath)) return null;
  const exe = path.join(resourcesPath, "tesseract", "tesseract.exe");
  if (!exists(exe)) return null;
  return { exe, tessdataDir: path.join(resourcesPath, "tesseract", "tessdata") };
}

/**
 * Back-compat helper: absolute path of the Tesseract executable (or throws
 * the Arabic "not found" error). Callers needing the tessdata dir should use
 * {@link resolveTesseract} instead.
 */
export function findTesseract(deps: TessDeps = {}): string {
  return resolveTesseract(deps).exe;
}

/**
 * Runs the Tesseract engine (Arabic + English) on an image or PDF file and
 * returns the extracted text. Raster images are preprocessed (grayscale +
 * contrast normalization) to improve OCR accuracy. When the BUNDLED engine is
 * used, `--tessdata-dir` and `TESSDATA_PREFIX` are passed explicitly so the
 * engine can never pick up an unrelated tessdata. Throws if the engine is
 * missing or fails.
 */
export async function runTesseractOcr(filePath: string, deps: TessDeps = {}): Promise<string> {
  const { exe, tessdataDir } = resolveTesseract(deps);
  const exec = deps.execFile ?? execFileAsync;
  const input = await preprocessForOcr(filePath);
  try {
    const args = ["-l", "ara+eng", "--psm", "3"];
    if (tessdataDir) args.unshift("--tessdata-dir", tessdataDir);
    const { stdout } = await exec(exe, [...args, input, "stdout"], {
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
      windowsHide: true,
      env: tessdataDir ? { ...process.env, TESSDATA_PREFIX: tessdataDir } : process.env,
    });
    return stdout.trim();
  } finally {
    if (input !== filePath) await unlink(input).catch(() => {});
  }
}

/** Grayscale + normalize raster images into a temp PNG for better OCR. */
async function preprocessForOcr(filePath: string): Promise<string> {
  if (!RASTER_EXTS.has(path.extname(filePath).toLowerCase())) return filePath;
  try {
    const out = path.join(tmpdir(), `edms-ocr-${Date.now()}.png`);
    await sharp(filePath).rotate().grayscale().normalize().png().toFile(out);
    return out;
  } catch {
    return filePath;
  }
}