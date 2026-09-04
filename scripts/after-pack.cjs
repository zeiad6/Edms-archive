"use strict";
/*
 * electron-builder afterPack hook — copies the staged Next standalone server
 * into the unpacked app AFTER packaging completed, so electron-builder never
 * touches (or prunes) its node_modules. electron-builder prunes node_modules
 * from extraResources, and asarUnpack blows the Windows MAX_PATH limit, so
 * this manual copy is the only reliable route.
 */
const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  const { appOutDir } = context;
  const src = path.resolve(__dirname, "..", "dist", "standalone");
  const dest = path.join(appOutDir, "resources", "standalone");

  if (!fs.existsSync(path.join(src, "server.js"))) {
    throw new Error(`afterPack: standalone server.js missing at ${src}`);
  }

  // Copy while skipping the .next/node_modules duplication left behind by
  // Turbopack's output tracing (a duplicate of the real node_modules) — it
  // adds weight and pushes paths toward MAX_PATH.
  const SKIP = [".next", "node_modules", "public"];

  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (SKIP.includes(entry)) continue;
    fs.cpSync(path.join(src, entry), path.join(dest, entry), { recursive: true });
  }
  // .next must be copied WHOLE — server/ chunks, BUILD_ID, manifests AND
  // .next/node_modules. Turbopack resolves native-external packages
  // (@libsql/client, sharp) by HASHED names (e.g.
  // @libsql/client-6da938047d5fc1cd) INSIDE .next/node_modules, and the SSR
  // chunks import exactly those paths — skipping them breaks the build.
  fs.cpSync(path.join(src, ".next"), path.join(dest, ".next"), { recursive: true });
  // node_modules and public are copied verbatim.
  fs.cpSync(path.join(src, "node_modules"), path.join(dest, "node_modules"), {
    recursive: true,
  });
  fs.cpSync(path.join(src, "public"), path.join(dest, "public"), { recursive: true });

  // ------------------------------------------------------------------
  // Complete STUB packages. Turbopack's standalone trace emits only
  // package.json (or a partial tree) for native/external modules it
  // cannot bundle. Inside the project tree this is harmless — the
  // hashed .next/node_modules entries are symlinks into the project's
  // complete node_modules, and Node resolves through the realpath. But
  // 7za (portable build) materializes those symlinks into real files,
  // so resolution lands on the stub -> MODULE_NOT_FOUND -> HTTP 500 on
  // every page ("Failed to load external module ... Cannot find module
  // '@neon-rs/load/dist/index.js'"). Overwrite the stubs with the full
  // Overwrite Turbopack standalone stubs with full packages from the project
  // tree so the app is self-contained. List is built DYNAMICALLY from
  // package.json `dependencies` (top-level) + a small optional allowlist
  // below for native/runtime subpaths Turbopack traces by hashed names.
  // Extend without code change: AFTERPACK_EXTRA_PKGS="pkg-a,pkg-b/subpath".
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8")
  );
  const TOP_LEVEL_DEPS = Object.keys(pkgJson.dependencies || {});
  // Small allowlist: subpaths / platform binaries NOT enumerable as top-level
  // deps but required at runtime (hashed .next/node_modules symlinks, libvips
  // DLLs, Next compiled templates). Keep minimal; everything else auto-syncs
  // with package.json so renames no longer break silently.
  const RUNTIME_SUBPATH_ALLOWLIST = [
    "@libsql/win32-x64-msvc", // .node binary
    "@img/sharp-win32-x64", // libvips DLLs — NOT traced by Turbopack
    "@img/colour",
    "@neon-rs/load", // libsql native loader (confirmed 500 cause, transitive)
    "libsql", // native sqlite binding wrapper (transitive via @libsql/client)
    "next/dist/compiled/next-server", // pruned app-route-turbo.runtime.prod.js
    "next/dist/compiled/regenerator-runtime", // pruned path.js
  ];
  const envExtra = (process.env.AFTERPACK_EXTRA_PKGS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const EXTERNAL_PACKAGES = [
    ...TOP_LEVEL_DEPS,
    ...RUNTIME_SUBPATH_ALLOWLIST,
    ...envExtra.filter((p) => !TOP_LEVEL_DEPS.includes(p)),
  ];
  const projectModules = path.resolve(__dirname, "..", "node_modules");
  const stagedModules = path.join(dest, "node_modules");
  for (const pkg of EXTERNAL_PACKAGES) {
    const pkgSrc = path.join(projectModules, pkg);
    const pkgDst = path.join(stagedModules, pkg);
    if (!fs.existsSync(pkgSrc)) {
      console.warn(`afterPack: project node_modules/${pkg} not found — skipping`);
      continue;
    }
    fs.rmSync(pkgDst, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(pkgDst), { recursive: true });
    fs.cpSync(pkgSrc, pkgDst, { recursive: true });
    console.log(`afterPack: completed external package ${pkg}`);
  }

  const mb = (p) => Math.round((fs.statSync(p).size / 1024 / 1024) * 10) / 10;
  console.log(`afterPack: standalone staged at ${dest}`);
  console.log(
    `afterPack: total ${mb(dest)} MB (node_modules ${mb(path.join(dest, "node_modules"))} MB, .next ${mb(path.join(dest, ".next"))} MB)`
  );

  // ------------------------------------------------------------------
  // VERIFY the bundled Tesseract OCR runtime landed next to the app.
  // electron-builder copies extraResources (dist/resources -> appOutDir/
  // resources) BEFORE afterPack runs, so this check is authoritative.
  // An app without OCR must fail the build loudly, never ship silently.
  // ------------------------------------------------------------------
  const tessDir = path.join(appOutDir, "resources", "tesseract");
  const tessExe = path.join(tessDir, "tesseract.exe");
  const tessTessdata = path.join(tessDir, "tessdata");
  if (!fs.existsSync(tessExe)) {
    throw new Error(
      `afterPack: bundled tesseract.exe MISSING at ${tessExe} — ` +
        `scripts/build-electron.cjs must stage dist/resources/tesseract/ before electron-builder runs.`
    );
  }
  for (const td of ["ara.traineddata", "eng.traineddata", "osd.traineddata"]) {
    if (!fs.existsSync(path.join(tessTessdata, td))) {
      throw new Error(
        `afterPack: bundled tessdata/${td} MISSING at ${path.join(tessTessdata, td)} — OCR would be broken.`
      );
    }
  }
  let tessFiles = 0;
  (function count(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) count(path.join(dir, e.name));
      else tessFiles++;
    }
  })(tessDir);
  console.log(
    `afterPack: bundled tesseract runtime OK — ${tessFiles} files, ${mb(tessDir)} MB at ${tessDir}`
  );
};
