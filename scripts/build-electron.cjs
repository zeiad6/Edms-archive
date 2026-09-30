"use strict";
/*
 * EDMS packaging pipeline (Windows x64):
 *
 *   1. next build (output: standalone)           -> .next/standalone
 *   2. stage standalone + public + .next/static  -> dist/standalone
 *   3. copy scan-wia.ps1 (NO secrets — per-install AUTH_SECRET generated at first boot)
 *   4. bundle the Tesseract OCR runtime          -> dist/resources/tesseract
 *   5. obfuscate electron/main.cjs               -> dist/electron/main.cjs
 *   6. electron-builder (nsis, asar)             -> dist/release/*.exe
 *
 * No webpack/eslint in the shipped payload — the standalone server carries
 * only the runtime node_modules Next traced (sharp, libsql, archiver, ...).
 *
 * The app shells out to Tesseract for OCR. The full machine install is
 * ~740 MB (training tools, man pages, every language model, ...) — only the
 * RUNTIME set is bundled: tesseract.exe + root DLLs + ara/eng/osd traineddata
 * + tessdata/configs. electron-builder.yml `extraResources` copies
 * dist/resources -> resources/ next to the app, so packaged installs and the
 * portable exe get a fully self-contained OCR engine. If the source install
 * is missing, packaging FAILS LOUDLY — an installer without OCR must never
 * ship. Override the source with the TESSERACT_SRC env var.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const distRoot = path.join(root, "dist");
const stageStandalone = path.join(distRoot, "standalone");
const stageElectron = path.join(distRoot, "electron");
const stageResources = path.join(distRoot, "resources");

function sh(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
}

function cpR(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

// ---------------------------------------------------------------------------
// Tesseract OCR runtime bundle — the app must be self-contained: no external
// Tesseract install required on target machines. Keeps ONLY:
//   - tesseract.exe + every root-level *.dll (runtime deps)
//   - tessdata/{ara,eng,osd}.traineddata + tessdata/configs/
// Everything else (training/utility tools, man pages, ~100 extra language
// models, fonts, jars, uninstaller, doc/) is dead weight and is excluded.
// ---------------------------------------------------------------------------
function stageTesseractBundle() {
  const tessSource = process.env.TESSERACT_SRC || "E:\\Program Files\\Tesseract-OCR";
  if (!fs.existsSync(tessSource)) {
    throw new Error(
      `[build-electron] Tesseract OCR source NOT FOUND at "${tessSource}".\n` +
        "The installer must NOT ship without OCR. Install Tesseract 5.x there\n" +
        "or point TESSERACT_SRC at the Tesseract-OCR directory. Aborting packaging."
    );
  }
  const destRoot = path.join(stageResources, "tesseract");
  fs.rmSync(destRoot, { recursive: true, force: true });
  fs.mkdirSync(destRoot, { recursive: true });

  const keepRoot = (name) => name === "tesseract.exe" || name.toLowerCase().endsWith(".dll");
  const rootEntries = fs.readdirSync(tessSource);
  const missing = [];
  for (const name of rootEntries) {
    if (!keepRoot(name)) continue;
    fs.copyFileSync(path.join(tessSource, name), path.join(destRoot, name));
  }

  // tessdata — ONLY the languages the UI actually uses + configs/.
  const tessdataSrc = path.join(tessSource, "tessdata");
  const tessdataDst = path.join(destRoot, "tessdata");
  if (!fs.existsSync(tessdataSrc)) {
    throw new Error(`[build-electron] Tesseract tessdata missing at "${tessdataSrc}". Aborting packaging.`);
  }
  fs.mkdirSync(tessdataDst, { recursive: true });
  for (const name of ["ara.traineddata", "eng.traineddata", "osd.traineddata"]) {
    const src = path.join(tessdataSrc, name);
    if (!fs.existsSync(src)) missing.push(name);
    else fs.copyFileSync(src, path.join(tessdataDst, name));
  }
  const configsSrc = path.join(tessdataSrc, "configs");
  if (!fs.existsSync(configsSrc)) missing.push("tessdata/configs/");
  else fs.cpSync(configsSrc, path.join(tessdataDst, "configs"), { recursive: true });

  if (missing.length > 0) {
    throw new Error(
      `[build-electron] Bundled Tesseract runtime incomplete — missing from "${tessSource}": ${missing.join(", ")}. Aborting packaging.`
    );
  }

  // Stats (file count + size) for the build log.
  let fileCount = 0;
  let totalBytes = 0;
  (function count(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) count(path.join(dir, e.name));
      else {
        fileCount++;
        totalBytes += fs.statSync(path.join(dir, e.name)).size;
      }
    }
  })(destRoot);
  const mb = (totalBytes / 1024 / 1024).toFixed(1);
  console.log(
    `tesseract runtime staged: ${fileCount} files, ${mb} MB -> ${path.relative(root, destRoot)}`
  );
}

// Wipe prior dist FIRST — output file tracing runs during `next build` and
// would otherwise swallow dist/ (and any previous staging) into the
// standalone output, causing exponential re-inclusion across runs.
console.log("=== [1/7] clean dist/ ===");
fs.rmSync(distRoot, { recursive: true, force: true });

// `next build` prerenders routes, which runs the /api/health route handler ->
// ensureSeeded() -> src/db/index.ts opens `file:./data/edms.db` at module scope.
// Without the directory libsql throws ConnectionFailed(... : 14) and the build
// dies with "Failed to collect page data for /_not-found" — on a clean CI
// runner there is no data/ to begin with. Creating it here is the earliest
// point that is still inside our control; the real DB is created at first run.
fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.mkdirSync(path.join(root, "storage"), { recursive: true });

// `next build` runs with NODE_ENV=production, and src/lib/env.ts is designed
// to hard-fail there when AUTH_SECRET is missing or shorter than 32 chars.
// Prerendering imports that module (via /api/health -> ensureSeeded()), so a
// packaging host with no AUTH_SECRET exported fails with
// "Failed to collect configuration for /_not-found".
//
// The value below is a BUILD-TIME placeholder only. It signs nothing that
// ships: electron/main.cjs:ensureAuthSecret() generates a fresh 48-byte
// per-install secret on the operator's machine and writes it to userData with
// mode 0600, injected into process.env before the Next server starts. No
// session cookie is ever signed with the constant below.
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32
    ? process.env.AUTH_SECRET
    : require("crypto").randomBytes(32).toString("base64url");

console.log("=== [2/7] next build (standalone) ===");
sh("npx next build");

console.log("=== [3/7] stage standalone ===");
cpR(standalone, stageStandalone);
cpR(path.join(root, "public"), path.join(stageStandalone, "public"));
cpR(
  path.join(root, ".next", "static"),
  path.join(stageStandalone, ".next", "static")
);
// Turbopack's standalone trace copies the whole project root (docs, videos,
// logs, .env with SECRETS) next to server.js. Prune to a strict allowlist so
// installers stay lean and NEVER ship secrets or media.
{
  const keep = new Set(["server.js", "package.json", "node_modules", ".next", "public"]);
  let prunedBytes = 0;
  for (const name of fs.readdirSync(stageStandalone)) {
    if (keep.has(name)) continue;
    const p = path.join(stageStandalone, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      prunedBytes += (function du(dir) {
        let n = 0;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const q = path.join(dir, e.name);
          if (e.isDirectory()) n += du(q);
          else n += fs.statSync(q).size;
        }
        return n;
      })(p);
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      prunedBytes += st.size;
    }
    if (!st.isDirectory()) fs.rmSync(p, { force: true });
    console.log(`prune standalone: removed ${name} (${(prunedBytes / 1024 / 1024).toFixed(1)} MB total)`);
  }
}
console.log("standalone staged.");

console.log("=== [4/7] stage resources (scan script + env) ===");
fs.mkdirSync(stageResources, { recursive: true });
const scanScript = path.join(root, "scripts", "scan-wia.ps1");
if (fs.existsSync(scanScript)) {
  fs.copyFileSync(scanScript, path.join(stageResources, "scan-wia.ps1"));
}
// SECURITY: never bundle secrets into the installer. No .env is copied and
// no resources/env containing AUTH_SECRET is ever written here. Each
// install generates its own unique secret at first boot (see
// electron/main.cjs ensureAuthSecret → userData/auth_secret).
cpR(path.join(root, "resources", "icon"), path.join(stageResources, "icon"));

console.log("=== [5/7] stage bundled Tesseract OCR runtime ===");
stageTesseractBundle();

console.log("=== [6/7] obfuscate electron/main.cjs ===");
fs.mkdirSync(stageElectron, { recursive: true });
const src = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
const obf = JavaScriptObfuscator.obfuscate(src, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.6,
  identifierNamesGenerator: "hexadecimal",
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false, // keep startup fast; asar + no source maps is enough
  simplify: true,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.75,
  target: "node",
  transformObjectKeys: true,
}).getObfuscatedCode();
fs.writeFileSync(path.join(stageElectron, "main.cjs"), obf);
fs.copyFileSync(
  path.join(root, "electron", "preload.cjs"),
  path.join(stageElectron, "preload.cjs")
);
console.log("main.cjs obfuscated (stringArray + controlFlowFlattening + hex ids).");

console.log("=== [7/7] electron-builder (nsis x64, asar) ===");
// --publish never: update-info generation requires a configured publish
// provider (GitHub repo); local/manual releases ship the exes as-is.
// Setup installer only: it upgrades an existing install in place and keeps
// userData; the portable exe is no longer shipped.
sh("npx electron-builder --win nsis --x64 --publish never");
console.log("DONE - see dist/release/ (Setup .exe)");
