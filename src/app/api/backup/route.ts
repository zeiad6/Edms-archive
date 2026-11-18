import { NextResponse } from "next/server";
import {
  createReadStream,
  readdirSync,
  statSync,
  openSync,
  closeSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join, relative, basename, sep, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { client } from "@/db";
import { getCurrentUser, logAudit } from "@/lib/server";
import { can } from "@/lib/permissions";
import { checkpointWal } from "@/lib/db-maintenance";
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
 * non-secret values (UPDATE_URL etc. — never AUTH_SECRET). `.env` is strictly
 * excluded from backups so development secrets are never exported.
 */
function configFileSource(): string | null {
  const resourcesPath = (process as { resourcesPath?: string }).resourcesPath;
  if (typeof resourcesPath === "string") {
    const candidate = join(resourcesPath, "env");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Create a clean atomic snapshot of the live SQLite database into a temporary
 * file via `VACUUM INTO`. Falls back to `checkpointWal("TRUNCATE")` if
 * `VACUUM INTO` cannot run (e.g. in unit-test mocks without a real DB file).
 */
async function createCleanDbBackupTemp(liveDbPath: string): Promise<string | null> {
  if (!existsSync(liveDbPath)) return null;
  const tempPath = join(
    tmpdir(),
    `edms-backup-${Date.now()}-${randomBytes(6).toString("hex")}.db`,
  );
  try {
    const escaped = tempPath.replace(/\\/g, "/").replace(/'/g, "''");
    await client.execute(`VACUUM INTO '${escaped}'`);
    if (existsSync(tempPath)) return tempPath;
  } catch {
    await checkpointWal("TRUNCATE");
  }
  return null;
}

interface PartDef {
  id: string;
  name: string;
  dir: string | null; // directory part (walked recursively)
  file: string | null; // single-file part (config/env)
}

/**
 * GET /api/backup — streams a full backup as a single ZIP archive:
 * atomic database snapshot (`VACUUM INTO`), storage/**, scripts/**,
 * with a parts manifest at the zip root so restore can offer per-part
 * selection. Admin only.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "settings.manage")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const dirs = runtimeDirs();
  const liveDbFile = join(dirs.data, "edms.db");
  const cleanTempDb = await createCleanDbBackupTemp(liveDbFile);

  const parts: PartDef[] = [
    { id: "database", name: "قاعدة البيانات", dir: dirs.data, file: null },
    { id: "storage", name: "ملفات التخزين", dir: dirs.storage, file: null },
    { id: "scripts", name: "سكربتات النظام", dir: dirs.scripts, file: null },
    { id: "config", name: "إعدادات النظام", dir: null, file: configFileSource() },
  ];

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const stream = new PassThrough();

  const cleanupTemp = () => {
    if (cleanTempDb) {
      try {
        rmSync(cleanTempDb, { force: true });
      } catch {
        /* ignore */
      }
    }
  };

  archive.on("error", (err: Error) => {
    cleanupTemp();
    stream.destroy(err);
  });
  stream.on("close", cleanupTemp);
  stream.on("end", cleanupTemp);
  stream.on("error", cleanupTemp);

  archive.pipe(stream);

  const manifestParts: Array<{ id: string; name: string; size: number; count: number }> = [];

  for (const part of parts) {
    if (part.id === "database") {
      if (cleanTempDb && existsSync(cleanTempDb)) {
        const ok = appendFileSafe(archive, cleanTempDb, "database/edms.db");
        if (ok) {
          const sz = statSync(cleanTempDb).size;
          manifestParts.push({ id: "database", name: part.name, size: sz, count: 1 });
        }
        continue;
      }
    }

    // Collect candidate files for this part.
    const files: string[] = [];
    if (part.dir && existsSync(part.dir)) {
      walk(part.dir, (f) => {
        // Skip internal pre-upgrade backup snapshots and .env files inside data/
        const rel = relative(part.dir!, f).replace(/\\/g, "/");
        if (part.id === "database" && (rel.startsWith("backups/") || rel.endsWith(".pending") || rel.endsWith(".tmp"))) {
          return;
        }
        if (basename(f) === ".env" || basename(f).startsWith(".env.")) return;
        files.push(f);
      });
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

  // Kick off archive.finalize() asynchronously WITHOUT awaiting it before
  // returning the response — awaiting finalize() before piping to a consumer
  // deadlocks as soon as the archive exceeds PassThrough's highWaterMark.
  void Promise.resolve(archive.finalize()).catch((err) => {
    cleanupTemp();
    stream.destroy(err instanceof Error ? err : new Error(String(err)));
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "system.backup",
    entityType: "system",
    details: "تصدير نسخة احتياطية كاملة للنظام",
  });

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

  const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, { headers });
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