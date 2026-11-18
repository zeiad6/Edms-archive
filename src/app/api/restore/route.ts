import { NextResponse } from "next/server";
import {
  mkdirSync,
  writeFileSync,
  realpathSync,
  lstatSync,
  existsSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { join, resolve, relative, dirname, isAbsolute, sep } from "node:path";
import AdmZip from "adm-zip";
import { getCurrentUser, logAudit } from "@/lib/server";
import { can } from "@/lib/permissions";
import { createPreUpgradeSnapshot } from "@/lib/upgrade-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PART_IDS = new Set(["database", "storage", "scripts", "config"]);
const MAX_BACKUP_SIZE = 500 * 1024 * 1024; // 500 MB compressed ZIP
const MAX_UNCOMPRESSED_SIZE = 1024 * 1024 * 1024; // 1 GB total uncompressed (Zip Bomb guard)
const MAX_ENTRY_COUNT = 10_000; // max files in archive (Zip Bomb guard)
const SQLITE_MAGIC_HEADER = "SQLite format 3\0";

/**
 * An error whose message is written for the operator and is therefore safe to
 * return verbatim. Everything else that escapes the apply phase is treated as
 * an internal failure: logged with its stack, never echoed to the client.
 */
class UserFacingError extends Error {}

/**
 * Runtime roots — same resolution as the backup route (env first, cwd/…
 * dev fallback). The Electron shell sets these at boot.
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

interface PartManifestEntry {
  id: string;
  name: string;
  size: number;
  count: number;
}

/**
 * POST /api/restore — two-phase restore from an edms-archive ZIP.
 *
 * Phase 1 (check): body = zip file only (no selectedParts) → validates the
 * zip + manifest and returns {ok:true, needSelection:true, manifest:{parts}}
 * WITHOUT applying anything, so the UI can render per-part checkboxes.
 *
 * Phase 2 (apply): body = zip file + selectedParts[] (repeated form fields) →
 * applies the selected parts:
 *   - storage / scripts: merged immediately into EDMS_STORAGE_DIR /
 *     EDMS_SCRIPTS_DIR (overwrite, preserves unknown files).
 *   - database: staged as edms.db.pending (+ .pending-wal/.pending-shm) —
 *     NEVER swapped under the live connection (Windows file lock).
 *   - config: staged to <EDMS_DATA_DIR parent>/config.env.
 *   A restore-pending.json flag is written so electron/main.cjs applies the
 *   database/config swap at next boot, before the server starts.
 *
 * Admin only.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "settings.manage")) {
    return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "طلب غير صالح — يلزم إرسال بيانات متعددة الأجزاء" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const selectedParts = form
    .getAll("selectedParts")
    .map((v) => String(v).trim())
    .filter(Boolean);

  // --- Validate the zip + manifest -----------------------------------------
  let zip: InstanceType<typeof AdmZip>;
  let manifest: { app: string; parts?: PartManifestEntry[] };
  try {
    if (
      !file ||
      typeof file !== "object" ||
      !("arrayBuffer" in file) ||
      typeof (file as File).arrayBuffer !== "function"
    ) {
      return NextResponse.json(
        { ok: false, error: "لم يتم إرفاق ملف ZIP" },
        { status: 400 }
      );
    }
    if ("size" in file && typeof (file as { size?: unknown }).size === "number") {
      if ((file as { size: number }).size > MAX_BACKUP_SIZE) {
        return NextResponse.json(
          { ok: false, error: "حجم ملف النسخة الاحتياطية يتجاوز الحد المسموح (500 ميجابايت)" },
          { status: 413 }
        );
      }
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BACKUP_SIZE) {
      return NextResponse.json(
        { ok: false, error: "حجم ملف النسخة الاحتياطية يتجاوز الحد المسموح (500 ميجابايت)" },
        { status: 413 }
      );
    }
    zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    if (entries.length > MAX_ENTRY_COUNT) {
      throw new Error(`عدد الملفات في الأرشيف يتجاوز الحد الآمن (${MAX_ENTRY_COUNT} ملف)`);
    }
    let declaredUncompressedTotal = 0;
    for (const entry of entries) {
      const sz = Number(entry.header?.size ?? 0);
      if (sz < 0) throw new Error("حجم غير صالح داخل ملف الأرشيف");
      declaredUncompressedTotal += sz;
      if (declaredUncompressedTotal > MAX_UNCOMPRESSED_SIZE) {
        throw new Error("الحجم الإجمالي بعد فك الضغط يتجاوز الحد الآمن المسموح به (حماية من Zip Bomb)");
      }
    }
    const manifestEntry = zip.getEntry("manifest.json");
    if (!manifestEntry) {
      throw new Error("الملف لا يحتوي على manifest.json");
    }
    manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as typeof manifest;
    if (manifest.app !== "edms-archive") {
      throw new Error("هذا ليس ملف نسخة احتياطية صالح لهذا التطبيق");
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "ملف ZIP غير صالح" },
      { status: 400 }
    );
  }

  // --- Phase 1: check only — return the manifest parts for the UI ----------
  if (selectedParts.length === 0) {
    const parts = (Array.isArray(manifest.parts) ? manifest.parts : []).map((p) => ({
      id: p.id,
      name: p.name,
      size: p.size ?? 0,
      count: p.count ?? 0,
    }));
    return NextResponse.json({
      ok: true,
      needSelection: true,
      manifest: { parts },
    });
  }

  // --- Phase 2: apply -------------------------------------------------------
  const dirs = runtimeDirs();
  const applied: string[] = [];
  const pendingRestart: string[] = [];
  let configPath: string | null = null;
  const overwrittenBackups = new Map<string, Buffer | null>();

  try {
    // Automatic pre-restore snapshot of current database so user data is safe
    await createPreUpgradeSnapshot("pre-restore").catch(() => null);

    let extractedBytesTotal = 0;
    const trackBytes = (len: number) => {
      extractedBytesTotal += len;
      if (extractedBytesTotal > MAX_UNCOMPRESSED_SIZE) {
        throw new UserFacingError("الحجم الفعلي بعد فك الضغط يتجاوز الحد الآمن المسموح به");
      }
    };

    for (const id of selectedParts) {
      if (!PART_IDS.has(id)) continue; // ignore unknown part ids

      if (id === "storage") {
        extractPartMerge(zip, "storage/", dirs.storage, overwrittenBackups, trackBytes);
        applied.push(id);
      } else if (id === "scripts") {
        extractPartMerge(zip, "scripts/", dirs.scripts, overwrittenBackups, trackBytes);
        applied.push(id);
      } else if (id === "config") {
        const entry = zip.getEntry("config/env");
        if (!entry) {
          throw new UserFacingError("الملف لا يحتوي على إعدادات النظام (config/env)");
        }
        const data = entry.getData();
        trackBytes(data.length);
        // Never write into resources/ live (may be read-only on some
        // installs) — stage next to the data dir; the boot hook copies it
        // to the real env source after a restart.
        configPath = join(dirname(resolve(dirs.data)), "config.env");
        mkdirSync(dirname(configPath), { recursive: true });
        writeFileSync(configPath, data);
        pendingRestart.push(id);
      } else if (id === "database") {
        const staged = stageDatabasePending(zip, dirs.data, trackBytes);
        if (!staged) {
          throw new UserFacingError("الملف لا يحتوي على قاعدة بيانات (database/edms.db)");
        }
        pendingRestart.push(id);
      }
    }

    if (applied.length === 0 && pendingRestart.length === 0) {
      return NextResponse.json(
        { ok: false, error: "لم يتم اختيار أي جزء صالح للاستعادة" },
        { status: 400 }
      );
    }

    // Flag for the boot-time swap (electron/main.cjs) — only when a restart
    // is actually needed (database/config parts).
    if (pendingRestart.length > 0) {
      const flag = {
        parts: pendingRestart,
        configPath,
        pendingDb: resolve(dirs.data),
      };
      writeFileSync(
        join(dirs.data, "restore-pending.json"),
        JSON.stringify(flag, null, 2)
      );
    }

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "system.restore",
      entityType: "system",
      details: `استعادة نسخة احتياطية (${[...applied, ...pendingRestart].join(", ")})`,
    });

    return NextResponse.json({ ok: true, applied, pendingRestart });
  } catch (e) {
    // Automatic rollback of any files modified in this restore request
    for (const [destPath, oldContent] of overwrittenBackups.entries()) {
      try {
        if (oldContent === null) {
          rmSync(destPath, { force: true });
        } else {
          writeFileSync(destPath, oldContent);
        }
      } catch {
        /* best-effort rollback */
      }
    }
    if (configPath) {
      try {
        rmSync(configPath, { force: true });
      } catch {
        /* ignore */
      }
    }
    try {
      rmSync(join(dirs.data, "edms.db.pending"), { force: true });
      rmSync(join(dirs.data, "edms.db.pending-wal"), { force: true });
      rmSync(join(dirs.data, "edms.db.pending-shm"), { force: true });
      rmSync(join(dirs.data, "restore-pending.json"), { force: true });
    } catch {
      /* ignore */
    }

    console.error("[restore] apply failed", e);
    const message =
      e instanceof UserFacingError ? e.message : "فشلت الاستعادة — تحقق من صلاحيات الكتابة";
    return NextResponse.json({ ok: false, error: message, applied: [] }, { status: 500 });
  }
}

/**
 * Verify that `targetDir` and every existing path segment leading up to `dest`
 * contains no symlinks and resolves inside `realTarget` BEFORE calling
 * `mkdirSync`. This closes the Symlink Traversal TOCTOU gap where `mkdirSync`
 * would otherwise traverse an existing symlink directory before `realpathSync`.
 */
function assertNoSymlinkChainBeforeMkdir(realTarget: string, targetDir: string, dest: string): void {
  const rel = relative(targetDir, dest);
  const segments = rel.split(/[\\/]/).filter(Boolean);
  let current = targetDir;
  for (let i = 0; i < segments.length; i++) {
    current = join(current, segments[i]);
    if (existsSync(current)) {
      const st = lstatSync(current);
      if (st.isSymbolicLink()) {
        throw new UserFacingError(
          i === segments.length - 1
            ? "تعذّرت الاستعادة: الملف موجود كرابط رمزي (symlink) — تحقّق من مجلد النسخ الاحتياطي"
            : "تعذّرت الاستعادة: مسار المجلد الهدف يحتوي على رابط رمزي (symlink) — تحقّق من مجلد النسخ الاحتياطي",
        );
      }
      if (st.isDirectory()) {
        const rp = realpathSync(current);
        if (rp !== realTarget && !rp.startsWith(realTarget + sep)) {
          throw new UserFacingError(
            "تعذّرت الاستعادة: مسار المجلد الهدف يحتوي على رابط رمزي (symlink) — تحقّق من مجلد النسخ الاحتياطي",
          );
        }
      }
    }
  }
}

/**
 * Merge-extract a zip directory into a target dir with overwrite — preserves
 * unknown files already on disk (safer than rm-then-copy). Path traversal and
 * symlink traversal are blocked BEFORE `mkdirSync` and verified again after.
 */
function extractPartMerge(
  zip: InstanceType<typeof AdmZip>,
  prefix: string,
  targetDir: string,
  overwrittenBackups: Map<string, Buffer | null>,
  trackBytes: (len: number) => void,
): void {
  mkdirSync(targetDir, { recursive: true });
  if (lstatSync(targetDir).isSymbolicLink()) {
    throw new UserFacingError(
      "تعذّرت الاستعادة: مسار المجلد الهدف يحتوي على رابط رمزي (symlink) — تحقّق من مجلد النسخ الاحتياطي",
    );
  }
  const realTarget = realpathSync(targetDir);

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, "/");
    if (!name.startsWith(prefix)) continue;
    const rel = name.slice(prefix.length).replace(/^\/+/, "");
    if (!rel) continue;
    const dest = resolve(targetDir, rel);
    const check = relative(targetDir, dest);
    if (check.startsWith("..") || isAbsolute(check)) continue; // traversal guard

    // Check symlink chain on all existing ancestors BEFORE mkdirSync
    assertNoSymlinkChainBeforeMkdir(realTarget, targetDir, dest);

    const parent = dirname(dest);
    mkdirSync(parent, { recursive: true });

    const realParent = realpathSync(parent);
    if (realParent !== realTarget && !realParent.startsWith(realTarget + sep)) {
      throw new UserFacingError(
        "تعذّرت الاستعادة: مسار المجلد الهدف يحتوي على رابط رمزي (symlink) — تحقّق من مجلد النسخ الاحتياطي"
      );
    }
    if (existsSync(dest) && lstatSync(dest).isSymbolicLink()) {
      throw new UserFacingError(
        "تعذّرت الاستعادة: الملف موجود كرابط رمزي (symlink) — تحقّق من مجلد النسخ الاحتياطي"
      );
    }

    const data = entry.getData();
    trackBytes(data.length);

    if (!overwrittenBackups.has(dest)) {
      overwrittenBackups.set(dest, existsSync(dest) ? readFileSync(dest) : null);
    }
    writeFileSync(dest, data);
  }
}

/**
 * Validate that a buffer starts with the 16-byte SQLite format 3 magic header.
 */
export function isValidSqliteFormat(buf: Buffer): boolean {
  if (buf.length < 16) return false;
  return buf.subarray(0, 16).toString("latin1") === SQLITE_MAGIC_HEADER;
}

/**
 * Stage the database part as *.pending files next to the live DB. Returns
 * true when at least the main edms.db was staged. Validates the SQLite magic
 * header and removes any stale pending/live WAL & SHM files so old WAL frames
 * cannot corrupt the restored database.
 */
function stageDatabasePending(
  zip: InstanceType<typeof AdmZip>,
  dataDir: string,
  trackBytes: (len: number) => void,
): boolean {
  const map: Record<string, string> = {
    "database/edms.db": "edms.db.pending",
    "database/edms.db-wal": "edms.db.pending-wal",
    "database/edms.db-shm": "edms.db.pending-shm",
  };
  let stagedMain = false;
  mkdirSync(dataDir, { recursive: true });

  // Clean up any stale pending or live WAL/SHM files before staging
  rmSync(join(dataDir, "edms.db.pending"), { force: true });
  rmSync(join(dataDir, "edms.db.pending-wal"), { force: true });
  rmSync(join(dataDir, "edms.db.pending-shm"), { force: true });
  rmSync(join(dataDir, "edms.db-wal"), { force: true });
  rmSync(join(dataDir, "edms.db-shm"), { force: true });

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, "/");
    const pendingName = map[name];
    if (!pendingName) continue;
    const data = entry.getData();
    trackBytes(data.length);
    if (pendingName === "edms.db.pending") {
      if (!isValidSqliteFormat(data)) {
        throw new UserFacingError("ملف قاعدة البيانات داخل النسخة الاحتياطية تالف أو ليس بصيغة SQLite 3 صالحة");
      }
      stagedMain = true;
    }
    writeFileSync(join(dataDir, pendingName), data);
  }
  return stagedMain;
}