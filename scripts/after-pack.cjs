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

  // Strict allowlist — NEVER copy stray root files (docs, media, logs, and
  // especially .env with secrets) into the installer, even if tracing drops
  // them next to server.js again.
  const ALLOW = new Set(["server.js", "package.json", "node_modules", ".next", "public"]);

  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (entry === ".next" || entry === "node_modules" || entry === "public") continue; // copied whole below
    if (!ALLOW.has(entry)) {
      console.log(`afterPack: skipping non-runtime file ${entry}`);
      continue;
    }
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
  // Client-only packages are NEVER required by the Next server — verified by
  // grepping dist/standalone/.next/server for static requires (they ship to
  // the browser pre-bundled inside .next/static). Skipping the full-copy
  // overwrite leaves Turbopack's stub in place and saves ~110 MB of
  // installer/extraction weight. If a future server route statically imports
  // one of these, add it back here — the symptom would be 500s on that route
  // only. AFTERPACK_EXTRA_PKGS always wins over this skip list.
  const CLIENT_ONLY_SKIP = new Set([
    "mermaid", // dynamic import() inside an effect (mermaid-renderer.tsx)
    "ag-grid-community", // dynamic(ssr:false) via ag-grid-client.tsx
    "ag-grid-react", // same — client chunk only
    "@zxing/library", // browser barcode readers only (barcode-scanner.ts)
    "dompurify", // dynamic import() inside an effect (mermaid-renderer.tsx)
  ]);
  const EXTERNAL_PACKAGES = [
    ...TOP_LEVEL_DEPS,
    ...RUNTIME_SUBPATH_ALLOWLIST,
    ...envExtra.filter((p) => !TOP_LEVEL_DEPS.includes(p)),
  ];
  const projectModules = path.resolve(__dirname, "..", "node_modules");
  const stagedModules = path.join(dest, "node_modules");
  for (const pkg of EXTERNAL_PACKAGES) {
    if (CLIENT_ONLY_SKIP.has(pkg) && !envExtra.includes(pkg)) {
      console.log(`afterPack: skipping client-only package ${pkg} (stub stays)`);
      continue;
    }
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

  // Prune Next.js SWC binaries for other OS/arch (only win32-x64-msvc can
  // ever load on the target). Saves ~100 MB of installer weight.
  //
  // Plus two more never-loaded payloads:
  //   - *.map source maps (~180 MB): the standalone server has no
  //     source-map-support, so maps are pure extraction weight.
  //   - pdfjs-dist/web + pdfjs-dist/types: the full viewer app + TS types.
  //     The server uses legacy/build only (src/lib/pdf-text.ts) and the
  //     browser uses pre-bundled static chunks. cmaps/standard_fonts stay
  //     (Arabic PDF text extraction).
  {
    let freed = 0;
    const kill = (p) => {
      try {
        freed += fs.statSync(p).size;
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`afterPack: pruned ${path.relative(dest, p)}`);
      } catch { /* already gone */ }
    };
    const walkSwc = (dir) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch { return; }
      for (const e of entries) {
        const q = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (/^@next[\\/]swc-/.test(path.relative(stagedModules, q).replace(/\\/g, "/")) && !/win32-x64-msvc/.test(q)) {
            // Optional-platform SWC package (darwin/linux/...) — never loaded here.
            kill(q);
          } else {
            walkSwc(q);
          }
        } else if (/^next-swc\..*\.node$/.test(e.name) && !e.name.includes("win32-x64-msvc")) {
          kill(q);
        }
      }
    };
    walkSwc(stagedModules);
    // Source maps + pdfjs viewer/types: walk everything under node_modules.
    {
      const pdfjsBase = path.join(stagedModules, "pdfjs-dist");
      for (const sub of ["web", "types"]) {
        kill(path.join(pdfjsBase, sub));
      }
      const walkMaps = (dir) => {
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch { return; }
        for (const e of entries) {
          const q = path.join(dir, e.name);
          if (e.isDirectory()) walkMaps(q);
          else if (e.name.endsWith(".map")) {
            try {
              freed += fs.statSync(q).size;
              mapCount++;
              fs.rmSync(q, { force: true });
            } catch { /* already gone */ }
          }
        }
      };
      let mapCount = 0;
      walkMaps(stagedModules);
      if (mapCount > 0) console.log(`afterPack: pruned ${mapCount} source-map files`);
    }
    if (freed > 0) console.log(`afterPack: SWC prune freed ${(freed / 1024 / 1024).toFixed(1)} MB`);
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

  // Portable/NSIS shared-contract verify (static, no build): the child Next
  // server runs from resources/standalone, scan driver from resources/, and
  // main.cjs now passes TESSERACT_SRC/TESSDATA_PREFIX explicitly because the
  // ELECTRON_RUN_AS_NODE child has no process.resourcesPath. Fail loudly here
  // instead of shipping a portable exe that shows a blank window.
  {
    const resDir = path.join(appOutDir, "resources");
    const mustExist = [
      path.join(dest, "server.js"),
      path.join(dest, ".next", "BUILD_ID"),
      path.join(resDir, "scan-wia.ps1"),
      path.join(resDir, "icon", "icon-256.png"),
    ];
    for (const p of mustExist) {
      if (!fs.existsSync(p)) {
        throw new Error(`afterPack: required runtime file MISSING at ${p}`);
      }
    }
    console.log("afterPack: portable contract OK — standalone + scan-wia.ps1 + icon present");
  }
};
