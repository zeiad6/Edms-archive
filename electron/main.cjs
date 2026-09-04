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

const { app, BrowserWindow, ipcMain } = require("electron");

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

function userDataDir() {
  const base = app.getPath("userData"); // %APPDATA%/enterprise-edms
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
// Per-install AUTH_SECRET (first-boot generation). Stored in userData /
// auth_secret with mode 0600, injected into process.env.AUTH_SECRET before
// the Next server spawns. Never logged, never bundled in the installer.
// ---------------------------------------------------------------------------
function ensureAuthSecret() {
  if (process.env.AUTH_SECRET?.trim()) return process.env.AUTH_SECRET.trim();
  const file = path.join(app.getPath("userData"), "auth_secret");
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

  // Scan script lives outside asar too (child process must exec it).
  if (fs.existsSync(path.join(process.resourcesPath, "scan-wia.ps1"))) {
    fs.copyFileSync(
      path.join(process.resourcesPath, "scan-wia.ps1"),
      path.join(dirs.scripts, "scan-wia.ps1")
    );
  }

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: sdir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[next-err] ${d}`));
  serverProcess.on("exit", (code) => {
    if (code !== 0) console.error(`[next] exited with code ${code}`);
  });

  return waitForServer(port, 45_000);
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
    icon: path.join(__dirname, "..", "resources", "icon", "icon-256.png"),
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

  await win.loadURL(url);
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
}

// ---------------------------------------------------------------------------
// Lifecycle.
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    registerIpc();
    try {
      const url = await bootNext(await getFreePort());
      await createWindow(url);
    } catch (err) {
      console.error("[main] startup failed:", err);
      app.quit();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && win) win.show();
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-update: electron-updater (generic provider). The feed URL comes from
  // resources/env (UPDATE_URL) — packaged builds only; if unset, skip quietly
  // (offline / manual-update deployments). Latest.yml is published next to the
  // Setup exe, so an operator can host dist/release on any static server.
  // ---------------------------------------------------------------------------
  app.whenReady().then(() => {
    if (!app.isPackaged) return;
    let feedUrl = null;
    const envFile = path.join(process.resourcesPath, "env");
    if (fs.existsSync(envFile)) {
      const txt = fs.readFileSync(envFile, "utf8");
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*UPDATE_URL\s*=\s*(.*)\s*$/);
        if (m) feedUrl = m[1].replace(/^["']|["']$/g, "");
      }
    }
    if (!feedUrl) {
      console.log("[updater] UPDATE_URL not set — auto-update disabled");
      return;
    }
    try {
      const { autoUpdater } = require("electron-updater");
      autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on("update-downloaded", () => {
        if (win && !win.isDestroyed()) {
          const { dialog } = require("electron");
          dialog
            .showMessageBox(win, {
              type: "info",
              title: "تحديث متوفر",
              message: "تم تنزيل إصدار جديد من البرنامج.",
              detail: "أعد تشغيل البرنامج لتثبيت التحديث.",
              buttons: ["إعادة التشغيل الآن", "لاحقاً"],
              defaultId: 0,
              cancelId: 1,
            })
            .then((r) => {
              if (r.response === 0) autoUpdater.quitAndInstall();
            });
        }
      });
      autoUpdater.checkForUpdates().catch(() => {
        /* network/offline — ignore */
      });
      console.log(`[updater] checking ${feedUrl}`);
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
