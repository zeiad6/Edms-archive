"use strict";
/*
 * EDMS Electron shell — main process.
 *
 * Strategy: the app is a Next.js *server* (SQLite + API routes + WIA scan),
 * so a static export is not possible. We ship the Next standalone build
 * (`output: "standalone"` -> .next/standalone/server.js) as an extraResource
 * and run it as a child process with Electron's bundled Node
 * (ELECTRON_RUN_AS_NODE=1 -> no system Node required on the target machine).
 * The BrowserWindow then loads http://127.0.0.1:<port> with frame:false and
 * a custom RTL title bar.
 *
 * Security: contextIsolation:true, nodeIntegration:false, sandbox:true,
 * a minimal preload exposing only window controls via contextBridge.
 */

const { app, BrowserWindow, ipcMain, shell } = require("electron");

// Session cookie name — MUST mirror SESSION_COOKIE in src/lib/session.ts.
const SESSION_COOKIE = "edms_uid";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Constants & user-data redirection (asar payload is read-only, so all
// writable state lives in the OS userData folder).
// ---------------------------------------------------------------------------

const IS_DEV = !app.isPackaged;
const HOST = "127.0.0.1";
const PORT_MIN = 43110; // unlikely to collide; verified free before use

let serverProcess = null;
let win = null;

// Portable detection: electron-builder portable sets PORTABLE_EXECUTABLE_DIR.
// Portable must keep ALL writable state beside the exe (edms-data/), never in
// %APPDATA%, otherwise the "portable" exe is not portable and data is lost
// when moving the folder. NSIS keeps %APPDATA%/enterprise-edms.
function isPortable() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}
function portableBase() {
  return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath("exe"));
}
function baseUserData() {
  if (IS_DEV) return app.getPath("userData");
  if (isPortable()) return path.join(portableBase(), "edms-data");
  return app.getPath("userData");
}

function userDataDir() {
  const base = baseUserData();
  const dirs = {
    data: path.join(base, "data"),
    storage: path.join(base, "storage"),
    scripts: path.join(base, "scripts"),
  };
  for (const d of Object.values(dirs)) {
    fs.mkdirSync(d, { recursive: true });
  }
  return dirs;
}

// ---------------------------------------------------------------------------
// Startup diagnostics.
//
// A packaged app that dies during boot gives the user a blank window and CI
// nothing but an exit code, which is why a failed release used to be
// undiagnosable. Every boot milestone is appended to <userData>/logs/
// startup.log as well as stdout. Best-effort only — a broken log must never
// be the reason the app fails to start — and it never records secrets
// (AUTH_SECRET is never passed to this function).
// ---------------------------------------------------------------------------
function logStartup(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try {
    console.log(line);
  } catch { /* stdout closed — the file is the durable record */ }
  try {
    const dir = path.join(baseUserData(), "logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "startup.log"), line + "\n");
  } catch { /* diagnostics are best-effort */ }
}

// ---------------------------------------------------------------------------
// Per-install AUTH_SECRET (first-boot generation). Stored in userData /
// auth_secret with mode 0600, injected into process.env.AUTH_SECRET before
// the Next server spawns. Never logged, never bundled in the installer.
// ---------------------------------------------------------------------------
function ensureAuthSecret() {
  if (process.env.AUTH_SECRET?.trim()) return process.env.AUTH_SECRET.trim();
  const file = path.join(baseUserData(), "auth_secret");
  try {
    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, "utf8").trim();
      if (existing) {
        process.env.AUTH_SECRET = existing;
        return existing;
      }
    }
  } catch { /* fall through to generation */ }
  const generated = crypto.randomBytes(48).toString("base64url");
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, generated + "\n", { mode: 0o600 });
    try { fs.chmodSync(file, 0o600); } catch { /* Windows ACL — ignore */ }
  } catch (err) {
    throw new Error("[main] could not persist per-install AUTH_SECRET: " + err.message);
  }
  process.env.AUTH_SECRET = generated;
  return generated;
}

// ---------------------------------------------------------------------------
// Free-port selection.
// ---------------------------------------------------------------------------

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, HOST, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// ---------------------------------------------------------------------------
// Pending-restore swap (boot-time). The restore API never touches the live
// DB (Windows file locks — libsql keeps the old inode) — it stages *.pending
// files plus a restore-pending.json flag, and we apply the swap HERE, before
// the per-install AUTH_SECRET is ensured and before the Next server spawns.
// Failures are logged, never fatal — the app boots with whatever is on disk.
// ---------------------------------------------------------------------------

function applyPendingRestore(dataDir) {
  const flagFile = path.join(dataDir, "restore-pending.json");
  if (!fs.existsSync(flagFile)) return;
  try {
    const flag = JSON.parse(fs.readFileSync(flagFile, "utf8"));
    const parts = Array.isArray(flag.parts) ? flag.parts : [];
    if (parts.includes("database")) {
      const swap = (pendingName, targetName) => {
        const src = path.join(dataDir, pendingName);
        if (!fs.existsSync(src)) return;
        // copy+remove (not rename) so a locked target can't abort the swap
        fs.copyFileSync(src, path.join(dataDir, targetName));
        fs.rmSync(src, { force: true });
      };
      swap("edms.db.pending", "edms.db");
      swap("edms.db.pending-wal", "edms.db-wal");
      swap("edms.db.pending-shm", "edms.db-shm");
    }
    // SECURITY: never restore secrets into resources/env (would reintroduce
    // bundled-secret flaw). Packaged restores touching config are ignored;
    // dev may restore .env locally.
    if (
      parts.includes("config") &&
      flag.configPath &&
      fs.existsSync(flag.configPath)
    ) {
      if (IS_DEV) {
        fs.copyFileSync(flag.configPath, path.join(process.cwd(), ".env"));
      }
      fs.rmSync(flag.configPath, { force: true });
    }
    fs.rmSync(flagFile, { force: true });
    console.log("[restore] pending restore applied:", parts.join(", "));
  } catch (err) {
    // log and continue — never crash the app on a restore failure
    console.error("[restore] pending-restore swap failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Standalone Next server boot.
// ---------------------------------------------------------------------------

function nextServerDir() {
  // Dev: run the real Next dev server (npm run dev in another terminal).
  // Packaged: resources/standalone — copied straight into the unpacked app
  // by scripts/after-pack.cjs AFTER electron-builder finishes, so its
  // node_modules survives intact (electron-builder would prune it from
  // extraResources, and Node cannot exec from inside an asar).
  return IS_DEV
    ? null
    : path.join(process.resourcesPath, "standalone");
}

function waitForServer(port, timeoutMs) {
  const url = `http://${HOST}:${port}`;
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(url);
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Next server did not start in time"));
        else setTimeout(tryOnce, 400);
      });
      req.setTimeout(1500, () => req.destroy());
    };
    tryOnce();
  });
}

async function bootNext(port) {
  const dirs = userDataDir();

  // Boot-time pending-restore swap — MUST run before resources/env is read
  // (AUTH_SECRET below) and before the server spawns. Dev resolves the data
  // dir the same way the dev server does (cwd/data — EDMS_DATA_DIR is only
  // set for the packaged child process).
  applyPendingRestore(IS_DEV ? path.join(process.cwd(), "data") : dirs.data);

  if (IS_DEV) {
    // dev mode: expect `npm run dev` already running on its own port; we
    // simply skip booting and point the window at it.
    const devPort = process.env.EDMS_DEV_PORT || "3000";
    await waitForServer(Number(devPort), 20_000);
    return `http://${HOST}:${devPort}`;
  }

  const sdir = nextServerDir();
  const serverJs = path.join(sdir, "server.js");
  logStartup(`boot: dataDir=${dirs.data} userDataBase=${baseUserData()}`);
  logStartup(`boot: standalone=${serverJs} exists=${fs.existsSync(serverJs)}`);
  if (!fs.existsSync(serverJs)) {
    throw new Error(`standalone server.js not found at ${serverJs}`);
  }

  // Environment for the Next server — everything the app needs, sourced
  // from the packaged resources (resources/env) or sensible defaults.
  const env = { ...process.env };
  env.ELECTRON_RUN_AS_NODE = "1"; // use Electron's bundled Node
  env.HOSTNAME = HOST;
  env.PORT = String(port);
  env.EDMS_DATA_DIR = dirs.data;
  env.EDMS_STORAGE_DIR = dirs.storage;
  env.EDMS_SCRIPTS_DIR = dirs.scripts;
  env.DATABASE_URL = `file:${dirs.data.replace(/\\/g, "/")}/edms.db`;

  // AUTH_SECRET: per-install secret in userData/auth_secret (generated at
  // first boot). Never bundled via resources/env, never logged.
  ensureAuthSecret();
  env.AUTH_SECRET = process.env.AUTH_SECRET;

  // Bundled Tesseract: the Next child runs with ELECTRON_RUN_AS_NODE, so
  // process.resourcesPath is undefined inside it and src/lib/tesseract.ts
  // cannot resolve the bundled engine. Pass it explicitly (stale values fall
  // through inside resolveTesseract). Portable and NSIS share the same layout:
  // resources/tesseract/tesseract.exe + resources/tesseract/tessdata.
  try {
    const bundledExe = path.join(process.resourcesPath, "tesseract", "tesseract.exe");
    const bundledData = path.join(process.resourcesPath, "tesseract", "tessdata");
    if (fs.existsSync(bundledExe) && fs.existsSync(bundledData)) {
      env.TESSERACT_SRC = bundledExe;
      env.TESSDATA_PREFIX = bundledData;
    }
  } catch { /* OCR falls back to PATH/machine install */ }

  // Scan script lives outside asar too (child process must exec it).
  if (fs.existsSync(path.join(process.resourcesPath, "scan-wia.ps1"))) {
    fs.copyFileSync(
      path.join(process.resourcesPath, "scan-wia.ps1"),
      path.join(dirs.scripts, "scan-wia.ps1")
    );
  }

  logStartup(`boot: spawning Next server on port ${port} (cwd=${sdir})`);
  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: sdir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  serverProcess.stderr.on("data", (d) => {
    process.stderr.write(`[next-err] ${d}`);
    // The server's own stderr is the only explanation a failed boot ever
    // gets — without it in the log file the release gate is undebuggable.
    logStartup(`[next-err] ${String(d).trimEnd()}`);
  });
  serverProcess.on("error", (err) => logStartup(`[next] spawn error: ${err.message}`));
  serverProcess.on("exit", (code, signal) => {
    logStartup(`[next] server exited code=${code} signal=${signal}`);
    if (code !== 0) console.error(`[next] exited with code ${code}`);
  });

  try {
    const url = await waitForServer(port, 45_000);
    logStartup(`boot: server responding at ${url}`);
    return url;
  } catch (err) {
    logStartup(`boot: FAILED — ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Window: frameless + custom RTL title bar.
// ---------------------------------------------------------------------------

async function createWindow(url) {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false, // no default Windows chrome — custom title bar
    // App boots to the light theme (themeInit in layout.tsx only opts into
    // dark for an explicit stored preference) — match the light page
    // background so there is no dark flash while the renderer loads.
    backgroundColor: "#f2f5fa",
    // Packaged layout: extraResources land in process.resourcesPath (next to
    // app.asar), NOT under dist/ — the dev-relative path below only works
    // unpackaged. Without this the built app shows the default Electron icon.
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "icon", "icon-256.png")
      : path.join(__dirname, "..", "resources", "icon", "icon-256.png"),
    title: "أرشيف — نظام الأرشفة الإلكتروني",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Navigation lockdown. The renderer is served from http://127.0.0.1:<port>
  // and the UI opens several external links with target="_blank" (settings,
  // shell, login tabs, PDF preview). Without these two guards an unblocked
  // popup falls back to a same-window navigation, replacing the EDMS content
  // with an attacker-chosen origin while the app frame, custom title bar and
  // the window-control preload bridge stay live on top of it.
  //
  // `shell.openExternal` hands the URL to the OS browser, which is where an
  // outbound http(s) link actually belongs; everything else is denied.
  const isLocalAppUrl = (url) => {
    try {
      const parsed = new URL(url);
      return (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
      );
    } catch {
      return false;
    }
  };

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:\/\/|mailto:)/i.test(url)) {
      void shell.openExternal(url).catch(() => {});
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (isLocalAppUrl(url)) return;
    event.preventDefault();
    if (/^(https?:\/\/|mailto:)/i.test(url)) {
      void shell.openExternal(url).catch(() => {});
    }
  });

  // Same-origin redirects (the login → "/" hop) are already covered by
  // will-navigate; block in-page attachment navigations to a remote origin
  // so a crafted link cannot repurpose the window as a browser.
  win.webContents.on("will-redirect", (event, url) => {
    if (!isLocalAppUrl(url)) event.preventDefault();
  });

  // A renderer that dies, hangs or fails to load leaves the user staring at a
  // blank frameless window with no console. These are the only events that
  // explain it, so they all go to the durable boot log.
  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logStartup(
      `render: did-fail-load code=${errorCode} (${errorDescription}) mainFrame=${isMainFrame} url=${validatedURL}`
    );
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    logStartup(`render: process gone ${JSON.stringify(details)}`);
  });
  win.webContents.on("unresponsive", () => logStartup("render: unresponsive"));
  win.webContents.on("preload-error", (_e, preloadPath, err) => {
    logStartup(`render: preload-error ${preloadPath}: ${err && err.message}`);
  });
  // Electron >=36 passes a single `details` object; older builds pass
  // positional args. Accept both so a renderer error is never lost, but only
  // during boot — startup.log lives in userData and is never rotated, so
  // logging every console error for the life of the install would grow it
  // without bound for a page the user is using perfectly well.
  const consoleDeadline = Date.now() + 60_000;
  win.webContents.on("console-message", (...args) => {
    if (Date.now() > consoleDeadline) return;
    const d = args[1];
    const level = d && typeof d === "object" ? d.level : args[1];
    const message = d && typeof d === "object" ? d.message : args[2];
    const where = d && typeof d === "object" ? `${d.sourceId}:${d.lineNumber}` : `${args[4]}:${args[3]}`;
    if (typeof level !== "number" || level < 2) return;
    logStartup(`render: console ${where} ${message}`);
  });

  // Re-emit maximize/unmaximize so the title bar can swap the ⛶ glyph.
  const sendState = () => {
    if (!win.isDestroyed()) {
      win.webContents.send("window:state", {
        maximized: win.isMaximized(),
        fullscreen: win.isFullScreen(),
      });
    }
  };
  win.on("maximize", sendState);
  win.on("unmaximize", sendState);
  win.on("enter-full-screen", sendState);
  win.on("leave-full-screen", sendState);

  // Closing the desktop window = logging out: wipe the session cookie first
  // so the next launch always lands on the login screen. Best-effort and
  // async-safe — the close is re-issued after the cookies are removed.
  let loggingOut = false;
  win.on("close", (e) => {
    if (loggingOut) return; // second pass — really close
    e.preventDefault();
    loggingOut = true;
    (async () => {
      try {
        const ses = win.webContents.session;
        const all = await ses.cookies.get({});
        await Promise.all(
          all
            .filter((c) => c.name === SESSION_COOKIE)
            .map((c) => {
              const scheme = c.secure ? "https" : "http";
              const domain = (c.domain || "").replace(/^\./, "");
              return ses.cookies
                .remove(`${scheme}://${domain}${c.path || "/"}`, c.name)
                .catch(() => {});
            }),
        );
      } catch {
        /* logout is best-effort — never trap the window */
      } finally {
        if (win && !win.isDestroyed()) win.close();
      }
    })();
  });

  // Wait for the window to actually show a page instead of awaiting loadURL.
  //
  // loadURL() rejects with ERR_FAILED (-2) whenever its navigation is
  // SUPERSEDED — and the app redirects "/" to the login screen, so the first
  // load is always cancelled by the second. Treating that rejection as fatal
  // quit a perfectly working app on every launch (it exited 0 before, which is
  // why the release gate only ever saw "exited on startup (code 0)").
  //
  // did-finish-load is the honest signal: it fires for whichever navigation
  // won. A genuine failure still surfaces via did-fail-load on the main frame.
  const loadOnce = (target, ms) =>
    new Promise((resolve, reject) => {
      const done = (ok, why) => {
        clearTimeout(timer);
        win.webContents.removeListener("did-finish-load", onFinish);
        win.webContents.removeListener("did-fail-load", onFail);
        win.webContents.removeListener("render-process-gone", onGone);
        ok ? resolve() : reject(new Error(why));
      };
      const onFinish = (_e, isMainFrame) => {
        if (!isMainFrame) return;
        logStartup(`window: did-finish-load ${win.webContents.getURL()}`);
        done(true);
      };
      const onFail = (_e, code, description, failedUrl, isMainFrame) => {
        // ERR_ABORTED (-3) is a superseded navigation, not a failure.
        if (!isMainFrame || code === -3) return;
        done(false, `page load failed ${code} (${description}) ${failedUrl}`);
      };
      // A renderer that dies mid-load never comes back, so the load can no
      // longer complete. Fail now with the reason instead of leaving the user
      // staring at an empty window until the timeout expires.
      const onGone = (_e, details) => {
        const how = (details && details.reason) || "gone";
        const code = details && details.exitCode;
        done(false, `renderer ${how}${code == null ? "" : ` (exit ${code})`}`);
      };
      const timer = setTimeout(() => done(false, `window did not finish loading in ${ms}ms`), ms);
      win.webContents.on("did-finish-load", onFinish);
      win.webContents.on("did-fail-load", onFail);
      win.webContents.on("render-process-gone", onGone);
      logStartup(`window: loading ${target}`);
      win.loadURL(target).catch((err) => {
        // Supersession lands here as ERR_FAILED; did-finish-load still fires for
        // the winning navigation, so this is only fatal if nothing loads at all.
        logStartup(`window: loadURL rejected — ${(err && err.message) || err}`);
      });
    });

  // TEMPORARY diagnostic. Each entry is loaded in turn and the next one only
  // runs if this one survived, so a single run narrows the 0xC0000005 down to
  // the first target that dies.
  // "|" separates entries: a data: URL needs its own comma, so "," cannot.
  const probe = (process.env.EDMS_BOOT_PROBE || "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (probe.length) {
    for (const entry of probe) {
      const target = /^(about:|data:|https?:)/i.test(entry) ? entry : url.replace(/\/$/, "") + entry;
      await loadOnce(target, 20_000).then(
        () => logStartup(`window: PROBE OK ${target}`),
        (err) => {
          logStartup(`window: PROBE FAIL ${target} — ${err.message}`);
          throw err;
        }
      );
    }
  } else {
    await loadOnce(url, 45_000);
  }
  logStartup("window: page loaded");
  return win;
}

// ---------------------------------------------------------------------------
// IPC — window controls (the ONLY surface the renderer gets).
// ---------------------------------------------------------------------------

function registerIpc() {
  ipcMain.on("win:minimize", () => win && win.minimize());
  ipcMain.on("win:maximize-toggle", () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("win:close", () => win && win.close());
  ipcMain.handle("win:is-maximized", () => (win && !win.isDestroyed() ? win.isMaximized() : false));
  ipcMain.handle("win:state", () =>
    win && !win.isDestroyed()
      ? { maximized: win.isMaximized(), fullscreen: win.isFullScreen() }
      : { maximized: false, fullscreen: false }
  );

  registerSecureStoreIpc();
}

/*
 * Remembered credentials, encrypted with the OS keychain.
 *
 * `safeStorage.encryptString` uses DPAPI (Windows), Keychain (macOS) or
 * libsecret/kwallet (Linux). The encryption key never enters the renderer, so
 * the renderer can only ever obtain the ciphertext back. The blob is written
 * with mode 0600, matching `ensureAuthSecret`, and keys are namespaced so a
 * future record type cannot collide with an existing one.
 *
 * Everything is best-effort by design: if the platform has no keychain
 * (headless Linux, a locked session), the handlers report failure and the
 * renderer falls back to its Web Crypto path — see src/lib/credential-store.ts.
 */
function registerSecureStoreIpc() {
  const { safeStorage } = require("electron");
  const secretsFile = () => path.join(baseUserData(), "secrets.json");

  const readAll = () => {
    try {
      if (!fs.existsSync(secretsFile())) return {};
      return JSON.parse(fs.readFileSync(secretsFile(), "utf8")) || {};
    } catch {
      return {};
    }
  };

  const writeAll = (all) => {
    fs.mkdirSync(path.dirname(secretsFile()), { recursive: true });
    fs.writeFileSync(secretsFile(), JSON.stringify(all), { mode: 0o600 });
    try {
      fs.chmodSync(secretsFile(), 0o600);
    } catch {
      /* Windows ACL — ignore */
    }
  };

  // Keys are renderer-supplied, so they are constrained to a safe shape rather
  // than trusted: they become JSON keys and (via the renderer) nothing else,
  // but a key like "../x" should never be storable regardless.
  const validKey = (k) => typeof k === "string" && /^[a-z0-9_-]{1,64}$/i.test(k);

  ipcMain.handle("secure:set", (_e, key, value) => {
    try {
      if (!validKey(key) || typeof value !== "string") return false;
      if (!safeStorage.isEncryptionAvailable()) return false;
      const all = readAll();
      all[key] = safeStorage.encryptString(value).toString("base64");
      writeAll(all);
      return true;
    } catch (err) {
      console.error("[main] secure:set failed:", err);
      return false;
    }
  });

  ipcMain.handle("secure:get", (_e, key) => {
    try {
      if (!validKey(key)) return null;
      const blob = readAll()[key];
      if (typeof blob !== "string") return null;
      if (!safeStorage.isEncryptionAvailable()) return null;
      return safeStorage.decryptString(Buffer.from(blob, "base64"));
    } catch (err) {
      console.error("[main] secure:get failed:", err);
      return null;
    }
  });

  ipcMain.handle("secure:delete", (_e, key) => {
    try {
      if (!validKey(key)) return false;
      const all = readAll();
      if (!(key in all)) return true;
      delete all[key];
      writeAll(all);
      return true;
    } catch (err) {
      console.error("[main] secure:delete failed:", err);
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Lifecycle.
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // A second launch while the first is still running is NORMAL, not a crash:
  // it hands focus back to the live window and must exit 0 so launchers and
  // the release upgrade test do not read it as a startup failure.
  logStartup("boot: single-instance lock DENIED — another instance is running, handing over and exiting");
  app.quit();
} else {
  // Portable: redirect Electron userData beside the exe BEFORE ready, so
  // session/cache/auth_secret/data all live in <exe-dir>/edms-data.
  if (!IS_DEV && isPortable()) {
    try { app.setPath("userData", path.join(portableBase(), "edms-data")); } catch { /* keep default */ }
  }
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      logStartup("boot: app ready — starting Next server");
      registerIpc();
      const url = await bootNext(await getFreePort());
      await createWindow(url);
      logStartup("boot: window created, app is up");
    } catch (err) {
      // Record WHY before quitting: a packaged app that dies here shows the
      // user nothing and CI only an exit code. stack included because the
      // shipped main.cjs is obfuscated and the message alone is not enough.
      logStartup(`boot: FAILED — ${(err && err.stack) || err}`);
      console.error("[main] startup failed:", err);
      // Kill the child first: app.exit() skips before-quit, and a stray
      // ELECTRON_RUN_AS_NODE server would keep holding the SQLite lock and the
      // port, which is exactly what an operator (or the next launch) hits next.
      try {
        if (serverProcess && !serverProcess.killed) serverProcess.kill();
      } catch { /* nothing to clean up */ }
      // Non-zero so a failed boot is distinguishable from a clean second-launch
      // handover in release logs and in the upgrade test.
      app.exit(1);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && win) win.show();
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-update: electron-updater (GitHub provider, public repo — no token).
  // Policy is notify-only: when a new GitHub release exists the app shows an
  // Arabic notice and lets the user jump to the download page. No silent
  // download/install (builds are unsigned) — the user installs the Setup exe
  // themselves. Checks once shortly after boot, then every 6 hours.
  // ---------------------------------------------------------------------------
  const RELEASES_URL = "https://github.com/zeiad6/Edms-archive/releases/latest";
  function notifyUpdateAvailable(info) {
    if (!win || win.isDestroyed()) return;
    const { dialog } = require("electron");
    const ver = (info && info.version) || "";
    dialog
      .showMessageBox(win, {
        type: "info",
        title: "تحديث متوفر",
        message: `يتوفر إصدار جديد من البرنامج${ver ? ` (${ver})` : ""}.`,
        detail: "اضغط «الانتقال إلى التحميل» لفتح صفحة التنزيل في المتصفح، ثم ثبّت النسخة الجديدة.",
        buttons: ["الانتقال إلى التحميل", "لاحقاً"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((r) => {
        if (r.response === 0) shell.openExternal(RELEASES_URL).catch(() => {});
      })
      .catch(() => {});
  }
  app.whenReady().then(() => {
    if (!app.isPackaged) return;
    try {
      const { autoUpdater } = require("electron-updater");
      // Provider comes from electron-builder.yml `publish` (github) — the
      // packaged appId/productName/version identify the feed; no token needed
      // for public repos.
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = false;
      let notifiedFor = null;
      autoUpdater.on("update-available", (info) => {
        const ver = (info && info.version) || "latest";
        if (notifiedFor === ver) return; // notify once per version
        notifiedFor = ver;
        console.log(`[updater] update available: ${ver}`);
        notifyUpdateAvailable(info);
      });
      autoUpdater.on("update-not-available", () => {
        console.log("[updater] up to date");
      });
      autoUpdater.on("error", (e) => {
        // offline / rate-limited / no releases yet — never disturb the user
        console.log(`[updater] check failed (quiet): ${e && e.message}`);
      });
      const check = () => {
        autoUpdater.checkForUpdates().catch(() => {
          /* handled by the error listener */
        });
      };
      setTimeout(check, 20_000); // let the UI settle first
      setInterval(check, 6 * 60 * 60 * 1000);
      console.log("[updater] GitHub update checks enabled");
    } catch (e) {
      console.error("[updater] init failed:", e.message);
    }
  });

  app.on("window-all-closed", () => {
    app.quit(); // Windows: quit with the window (no tray).
  });

  app.on("before-quit", () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });
}
