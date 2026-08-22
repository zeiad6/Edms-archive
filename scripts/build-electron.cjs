"use strict";
/*
 * EDMS packaging pipeline (Windows x64):
 *
 *   1. next build (output: standalone)           -> .next/standalone
 *   2. stage standalone + public + .next/static  -> dist/standalone
 *   3. copy scan-wia.ps1 + env (AUTH_SECRET)     -> dist/resources
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

console.log("=== [2/7] next build (standalone) ===");
sh("npx next build");

console.log("=== [3/7] stage standalone ===");
cpR(standalone, stageStandalone);
cpR(path.join(root, "public"), path.join(stageStandalone, "public"));
cpR(
  path.join(root, ".next", "static"),
  path.join(stageStandalone, ".next", "static")
);
// make sure next.config rewrite targets exist (server.js serves from cwd)
console.log("standalone staged.");

console.log("=== [4/7] stage resources (scan script + env) ===");
fs.mkdirSync(stageResources, { recursive: true });
const scanScript = path.join(root, "scripts", "scan-wia.ps1");
if (fs.existsSync(scanScript)) {
  fs.copyFileSync(scanScript, path.join(stageResources, "scan-wia.ps1"));
}
// AUTH_SECRET (and any other runtime secrets) go OUTSIDE the asar, into
// resources/env — read by main.cjs at boot and injected into the server env.
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  const envTxt = fs
    .readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\s*(AUTH_SECRET|NEXT_PUBLIC_APP_URL|UPDATE_URL)\s*=/.test(l))
    .join("\n");
  fs.writeFileSync(path.join(stageResources, "env"), envTxt + "\n");
  console.log("resources/env written (AUTH_SECRET + NEXT_PUBLIC_APP_URL + UPDATE_URL only).");
}
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

console.log("=== [7/7] electron-builder (nsis + portable x64, asar) ===");
sh("npx electron-builder --win nsis portable --x64");
console.log("DONE - see dist/release/ (Setup .exe + Portable .exe)");
