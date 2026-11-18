import fs from "node:fs/promises";
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db, client, databaseUrl, applyConnectionPragmas } from "@/db";
import { APP_VERSION } from "@/lib/version";

/**
 * Target SQLite `PRAGMA user_version` schema level.
 *
 * Version history:
 *   0 — Legacy unversioned schema (v1.0.0 – v1.0.7)
 *   1 — Base tables + indexes + users auth columns (username, password_hash, must_change_password)
 *   2 — Document soft-delete (deleted_at, deleted_by_id) & metadata columns (keywords, source, notes, doc_type, doc_type_id)
 *   3 — Additive documents.ocr_text column + repair literal 'CURRENT_TIMESTAMP' strings + doc_type_id backfill
 */
export const TARGET_SCHEMA_VERSION = 3;
export const MAX_PRE_UPGRADE_SNAPSHOTS = 5;

export interface AppVersionRecord {
  version: string;
  schemaVersion: number;
  updatedAt: string;
  lastSnapshot?: string | null;
}

export interface SnapshotInfo {
  name: string;
  path: string;
  size: number;
  createdAt: string;
  version: string;
}

/**
 * Resolve the active database file path and data directory from `DATABASE_URL`
 * or `EDMS_DATA_DIR`.
 */
export function resolveDataPaths(): { dataDir: string; dbFile: string; backupsDir: string; versionFile: string } {
  let dbFile: string;
  if (databaseUrl.startsWith("file:")) {
    const raw = databaseUrl.slice("file:".length);
    dbFile = path.resolve(raw);
  } else if (process.env.EDMS_DATA_DIR) {
    dbFile = path.join(path.resolve(process.env.EDMS_DATA_DIR), "edms.db");
  } else {
    dbFile = path.join(process.cwd(), "data", "edms.db");
  }
  const dataDir = path.dirname(dbFile);
  const backupsDir = path.join(dataDir, "backups", "pre-upgrade");
  const versionFile = path.join(dataDir, "app-version.json");
  return { dataDir, dbFile, backupsDir, versionFile };
}

/**
 * Compare two semver-like strings (`1.0.7` vs `1.0.0`).
 * Returns >0 if a > b, <0 if a < b, 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function readRecordedAppVersion(): Promise<AppVersionRecord | null> {
  const { versionFile } = resolveDataPaths();
  try {
    const raw = await fs.readFile(versionFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppVersionRecord>;
    if (typeof parsed.version === "string") {
      return {
        version: parsed.version,
        schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : 0,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
        lastSnapshot: parsed.lastSnapshot ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeRecordedAppVersion(record: AppVersionRecord): Promise<void> {
  const { dataDir, versionFile } = resolveDataPaths();
  await fs.mkdir(dataDir, { recursive: true });
  const tmpFile = `${versionFile}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(record, null, 2) + "\n", "utf8");
  await fs.rename(tmpFile, versionFile);
}

export async function getSchemaUserVersion(): Promise<number> {
  const rows = (await db.all(sql`PRAGMA user_version`)) as Array<{ user_version?: number }>;
  return Number(rows[0]?.user_version ?? 0);
}

/**
 * Run SQLite integrity_check and foreign_key_check.
 * Throws if the database is corrupted or violates foreign key constraints.
 */
export async function verifyDatabaseIntegrity(opts: { enforceForeignKeys?: boolean } = {}): Promise<{
  integrityOk: boolean;
  foreignKeyViolations: number;
}> {
  const integrityRows = (await db.all(sql`PRAGMA integrity_check`)) as Array<Record<string, unknown>>;
  const firstVal = integrityRows[0] ? String(Object.values(integrityRows[0])[0] ?? "") : "";
  const integrityOk = integrityRows.length === 1 && firstVal.toLowerCase() === "ok";
  if (!integrityOk) {
    throw new Error(`فشل فحص سلامة قاعدة البيانات (PRAGMA integrity_check): ${ JSON.stringify(integrityRows) }`);
  }

  const fkRows = (await db.all(sql`PRAGMA foreign_key_check`)) as Array<Record<string, unknown>>;
  if (opts.enforceForeignKeys && fkRows.length > 0) {
    throw new Error(`فشل فحص المفاتيح الأجنبية (PRAGMA foreign_key_check): ${fkRows.length} مخالفة`);
  }

  return {
    integrityOk: true,
    foreignKeyViolations: fkRows.length,
  };
}

/**
 * Keep only the newest `maxKeep` snapshot `.db` files in `backupsDir`.
 */
export async function prunePreUpgradeSnapshots(
  backupsDir: string,
  maxKeep: number = MAX_PRE_UPGRADE_SNAPSHOTS,
): Promise<void> {
  try {
    const entries = await fs.readdir(backupsDir, { withFileTypes: true });
    const dbFiles: Array<{ name: string; fullPath: string; mtimeMs: number }> = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".db")) continue;
      const fullPath = path.join(backupsDir, entry.name);
      const st = await fs.stat(fullPath);
      dbFiles.push({ name: entry.name, fullPath, mtimeMs: st.mtimeMs });
    }
    // Sort newest first (by mtime, then lexicographically by name descending)
    dbFiles.sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));
    const toDelete = dbFiles.slice(maxKeep);
    for (const old of toDelete) {
      await fs.rm(old.fullPath, { force: true });
      await fs.rm(`${old.fullPath}-wal`, { force: true });
      await fs.rm(`${old.fullPath}-shm`, { force: true });
    }
  } catch (err) {
    console.warn("[upgrade] failed to prune old pre-upgrade snapshots:", err);
  }
}

/**
 * Create an atomic pre-upgrade snapshot using `VACUUM INTO`, falling back to
 * WAL checkpoint + file copy if needed. Prunes older snapshots beyond 5.
 */
export async function createPreUpgradeSnapshot(fromVersionLabel?: string): Promise<string | null> {
  const { dbFile, backupsDir } = resolveDataPaths();
  if (!existsSync(dbFile)) return null;
  try {
    const st = await fs.stat(dbFile);
    if (st.size === 0) return null;
  } catch {
    return null;
  }

  await fs.mkdir(backupsDir, { recursive: true });
  const versionTag = (fromVersionLabel || APP_VERSION).replace(/[^a-zA-Z0-9._-]/g, "_");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `edms-pre-v${versionTag}-${stamp}.db`;
  const snapshotPath = path.join(backupsDir, fileName);

  try {
    const escapedPath = snapshotPath.replace(/\\/g, "/").replace(/'/g, "''");
    await client.execute(`VACUUM INTO '${escapedPath}'`);
  } catch {
    // Fallback if VACUUM INTO is unsupported or target exists: checkpoint + copy
    try {
      await client.execute("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      /* ignore */
    }
    await fs.copyFile(dbFile, snapshotPath);
  }

  await prunePreUpgradeSnapshots(backupsDir, MAX_PRE_UPGRADE_SNAPSHOTS);
  return snapshotPath;
}

/**
 * Restore a pre-upgrade snapshot back into the active database after a failed
 * migration. Uses SQLite tables reconstruction on the open connection and also
 * copies the file back so both in-process and next-boot state are clean.
 */
export async function rollbackFromPreUpgradeSnapshot(snapshotPath: string): Promise<void> {
  const { dbFile } = resolveDataPaths();
  if (!snapshotPath || !existsSync(snapshotPath)) return;

  try {
    await client.execute("ROLLBACK");
  } catch {
    /* no active transaction */
  }

  try {
    // Checkpoint and overwrite main DB from the clean snapshot using ATTACH + copy or file copy
    await client.execute("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
    /* ignore */
  }

  try {
    // Copy snapshot bytes over the main dbFile and remove any -wal/-shm
    copyFileSync(snapshotPath, dbFile);
    rmSync(`${dbFile}-wal`, { force: true });
    rmSync(`${dbFile}-shm`, { force: true });
    await applyConnectionPragmas();
  } catch (err) {
    console.error("[upgrade] failed to restore snapshot file:", err);
  }
}

/**
 * List available pre-upgrade snapshots sorted newest-first.
 */
export async function listPreUpgradeSnapshots(): Promise<SnapshotInfo[]> {
  const { backupsDir } = resolveDataPaths();
  if (!existsSync(backupsDir)) return [];
  try {
    const entries = await fs.readdir(backupsDir, { withFileTypes: true });
    const out: SnapshotInfo[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".db")) continue;
      const fullPath = path.join(backupsDir, entry.name);
      const st = await fs.stat(fullPath);
      const m = /^edms-pre-v([^-]+(?:\.[^-]+)*)-(\d{4}-\d{2}-\d{2}T.+)\.db$/.exec(entry.name);
      out.push({
        name: entry.name,
        path: fullPath,
        size: st.size,
        createdAt: st.mtime.toISOString(),
        version: m?.[1] ?? "unknown",
      });
    }
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.name.localeCompare(a.name));
    return out;
  } catch {
    return [];
  }
}

/**
 * Synchronous helper for Electron main process (before Next.js starts):
 * checks `data/app-version.json` and creates a file-level pre-upgrade copy of
 * `edms.db` if an upgrade is about to happen.
 */
export function ensurePreUpgradeBackupSync(dataDir: string, currentVersion: string): string | null {
  try {
    const dbFile = path.join(dataDir, "edms.db");
    if (!existsSync(dbFile) || statSync(dbFile).size === 0) return null;

    const versionFile = path.join(dataDir, "app-version.json");
    let recordedVersion = "1.0.0";
    let recordedSchema = 0;
    if (existsSync(versionFile)) {
      try {
        const parsed = JSON.parse(readFileSync(versionFile, "utf8"));
        if (typeof parsed.version === "string") recordedVersion = parsed.version;
        if (typeof parsed.schemaVersion === "number") recordedSchema = parsed.schemaVersion;
      } catch {
        /* treat as legacy */
      }
    }

    if (compareSemver(currentVersion, recordedVersion) <= 0 && recordedSchema >= TARGET_SCHEMA_VERSION) {
      return null;
    }

    const backupsDir = path.join(dataDir, "backups", "pre-upgrade");
    mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const snapName = `edms-pre-v${recordedVersion.replace(/[^a-zA-Z0-9._-]/g, "_")}-${stamp}.db`;
    const snapPath = path.join(backupsDir, snapName);
    copyFileSync(dbFile, snapPath);
    if (existsSync(`${dbFile}-wal`)) {
      copyFileSync(`${dbFile}-wal`, `${snapPath}-wal`);
    }

    // Prune > 5 snapshots
    const files = readdirSync(backupsDir)
      .filter((f) => f.endsWith(".db"))
      .map((f) => ({ f, full: path.join(backupsDir, f), mtime: statSync(path.join(backupsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime || b.f.localeCompare(a.f));
    for (const old of files.slice(MAX_PRE_UPGRADE_SNAPSHOTS)) {
      rmSync(old.full, { force: true });
      rmSync(`${old.full}-wal`, { force: true });
      rmSync(`${old.full}-shm`, { force: true });
    }
    return snapPath;
  } catch (err) {
    console.error("[upgrade-sync] pre-upgrade backup failed:", err);
    return null;
  }
}
