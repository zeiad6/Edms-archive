import { NextResponse } from "next/server";
import {
  createReadStream,
  readdirSync,
  statSync,
  openSync,
  closeSync,
  existsSync,
} from "node:fs";
import { join, relative, basename, sep, resolve } from "node:path";
// archiver v8 is ESM with named class exports (ZipArchive/TarArchive/
// JsonArchive). A static named import (NOT createRequire) is required:
// createRequire compiles to a SYNCHRONOUS __turbopack_require__ call which
// only resolves modules registered in the same chunk — archiver lives in
// another chunk, so packaged builds throw "p is not a function" (HTTP 500 on
// /api/backup). Static imports become async chunk loads and work everywhere.
import { ZipArchive } from "archiver";
import { createClient } from "@libsql/client";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * Runtime roots. The Electron shell sets EDMS_DATA_DIR / EDMS_STORAGE_DIR /
 * EDMS_SCRIPTS_DIR at boot (packaged: OS userData folder); dev falls back to
 * cwd/…  NEVER resolve from process.cwd() alone — in the packaged app cwd is
 * resources/standalone where these directories don't exist.
 */
function runtimeDirs() {
  return {
    data: process.env.EDMS_DATA_DIR
      ? resolve(process.env.EDMS_DATA_DIR)
      : join(process.cwd(), "data"),
    storage: process.env.EDMS_STORAGE_DIR
      ? resolve(process.env.EDMS_STORAGE_DIR)
      : join(process.cwd(), "storage"),
    scripts: process.env.EDMS_SCRIPTS_DIR
      ? resolve(process.env.EDMS_SCRIPTS_DIR)
      : join(process.cwd(), "scripts"),
  };
}

/**
 * Config source file (non-secret only). Packaged: resources/env holds only
 * non-secret values (UPDATE_URL etc. — never AUTH_SECRET since per-install
 * secret lives in userData/auth_secret); dev: project .env. Returns null when
 * neither exists — the config part is then skipped.
 */
function configFileSource(): string | null {
  const candidates: string[] = [];
  // process.resourcesPath is Electron-only (not in @types/node) — safe cast.
  const resourcesPath = (process as { resourcesPath?: string }).resourcesPath;
  if (typeof resourcesPath === "string") {
    candidates.push(join(resourcesPath, "env"));
  }
  candidates.push(join(process.cwd(), ".env"));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Best-effort WAL checkpoint before zipping the data dir. Runs on a throwaway
 * connection (same URL resolution as src/db/index.ts) so the .db file is as
 * complete as possible; -wal/-shm are still included when the checkpoint is
 * busy or fails. Never throws.
 */
async function tryCheckpoint(): Promise<void> {
  try {
    const url =
      process.env.DATABASE_URL ||
      (process.env.EDMS_DATA_DIR
        ? `file:${process.env.EDMS_DATA_DIR.replace(/\\/g, "/")}/edms.db`
        : "file:./data/edms.db");
    const client = createClient({ url });
    try {
      await client.execute({ sql: "PRAGMA wal_checkpoint(TRUNCATE)" });
    } finally {
      client.close();
    }
  } catch (e) {
    console.error("[backup] WAL checkpoint skipped:", e);
  }
}

interface PartDef {
  id: string;
  name: string;
  dir: string | null; // directory part (walked recursively)
  file: string | null; // single-file part (config/env)
}

/**
 * GET /api/backup — downloads a full backup as a single ZIP archive:
 * database (edms.db + -wal + -shm), storage/** , scripts/** and config/env,
 * with a parts manifest at the zip root so restore can offer per-part
 * selection. Admin only.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "settings.manage")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  await tryCheckpoint();

  const dirs = runtimeDirs();
  const parts: PartDef[] = [
    { id: "database", name: "قاعدة البيانات", dir: dirs.data, file: null },
    { id: "storage", name: "ملفات التخزين", dir: dirs.storage, file: null },
    { id: "scripts", name: "سكربتات النظام", dir: dirs.scripts, file: null },
    { id: "config", name: "إعدادات النظام", dir: null, file: configFileSource() },
  ];

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const stream = new (await import("node:stream")).PassThrough();

  archive.on("error", () => {
    stream.destroy();
  });
  archive.pipe(stream);

  const manifestParts: Array<{ id: string; name: string; size: number; count: number }> = [];

  for (const part of parts) {
    // Collect candidate files for this part.
    const files: string[] = [];
    if (part.dir && existsSync(part.dir)) {
      walk(part.dir, (f) => files.push(f));
    } else if (part.file && existsSync(part.file)) {
      files.push(part.file);
    }
    if (files.length === 0) continue;

    const prefix = `${part.id}/`;
    let size = 0;
    let count = 0;
    for (const file of files) {
      const rel = part.dir ? relative(part.dir, file) : basename(file);
      const zipName = `${prefix}${rel.split(sep).join("/")}`;
      const ok = appendFileSafe(archive, file, zipName);
      if (ok) {
        size += statSync(file).size;
        count += 1;
      }
    }
    if (count > 0) {
      manifestParts.push({ id: part.id, name: part.name, size, count });
    }
  }

  const manifest = {
    app: "edms-archive",
    version: APP_VERSION,
    created: new Date().toISOString(),
    parts: manifestParts,
  };

  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
  await archive.finalize();

  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;

  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set(
    "Content-Disposition",
    `attachment; filename="edms-backup-${stamp}.zip"`
  );
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new NextResponse(stream as unknown as BodyInit, { headers });
}

/**
 * Append a file to the archive with the same locked-file resilience as the
 * original implementation: pre-flight open (skip files locked right now —
 * e.g. sqlite -wal on Windows) and a stream error sink so a mid-read failure
 * can't destroy the whole ZIP.
 */
function appendFileSafe(archive: any, file: string, name: string): boolean {
  try {
    const fd = openSync(file, "r");
    closeSync(fd);
    const fileStream = createReadStream(file);
    // TOCTOU safety net: consume the error so it can't bubble into
    // archiver's error event and kill the whole ZIP.
    fileStream.on("error", () => {
      /* skip locked/unreadable file */
    });
    archive.append(fileStream, { name });
    return true;
  } catch {
    /* skip locked files (e.g. sqlite -wal while writing) */
    return false;
  }
}

function walk(dir: string, cb: (file: string) => void): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, cb);
    else if (entry.isFile()) cb(p);
  }
}