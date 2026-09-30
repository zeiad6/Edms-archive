import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync, realpathSync, lstatSync, existsSync } from "node:fs";
import { join, resolve, relative, dirname, isAbsolute, sep } from "node:path";
// adm-zip ships CJS with bundled types (types.d.ts). A static import (NOT
// createRequire) is required: createRequire compiles to a SYNCHRONOUS
// __turbopack_require__ which only resolves modules in the same chunk —
// packaged builds would throw "p is not a function". Static imports become
// async chunk loads and work in packaged builds.
import AdmZip from "adm-zip";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PART_IDS = new Set(["database", "storage", "scripts", "config"]);

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
    const buffer = Buffer.from(await file.arrayBuffer());
    zip = new AdmZip(buffer);
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

  try {
    for (const id of selectedParts) {
      if (!PART_IDS.has(id)) continue; // ignore unknown part ids

      if (id === "storage") {
        extractPartMerge(zip, "storage/", dirs.storage);
        applied.push(id);
      } else if (id === "scripts") {
        extractPartMerge(zip, "scripts/", dirs.scripts);
        applied.push(id);
      } else if (id === "config") {
        const entry = zip.getEntry("config/env");
        if (!entry) {
          throw new UserFacingError("الملف لا يحتوي على إعدادات النظام (config/env)");
        }
        // Never write into resources/ live (may be read-only on some
        // installs) — stage next to the data dir; the boot hook copies it
        // to the real env source after a restart.
        configPath = join(dirname(resolve(dirs.data)), "config.env");
        mkdirSync(dirname(configPath), { recursive: true });
        writeFileSync(configPath, entry.getData());
        pendingRestart.push(id);
      } else if (id === "database") {
        const staged = stageDatabasePending(zip, dirs.data);
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

    return NextResponse.json({ ok: true, applied, pendingRestart });
  } catch (e) {
    // Only deliberately-raised messages reach the client. Everything else is
    // a filesystem/driver failure whose `.message` carries absolute paths and
    // errno detail (e.g. "EACCES: permission denied, mkdir '/opt/edms/data'"),
    // so it is logged server-side and replaced with a generic line. `applied`
    // is still returned so the UI can show that a partial restore is live.
    console.error("[restore] apply failed", e);
    const message =
      e instanceof UserFacingError ? e.message : "فشلت الاستعادة — تحقق من صلاحيات الكتابة";
    return NextResponse.json({ ok: false, error: message, applied }, { status: 500 });
  }
}

/**
 * Merge-extract a zip directory into a target dir with overwrite — preserves
 * unknown files already on disk (safer than rm-then-copy). Path traversal is
 * blocked by resolving + checking the result stays under the target.
 */
function extractPartMerge(
  zip: InstanceType<typeof AdmZip>,
  prefix: string,
  targetDir: string
): void {
  // Resolve the target once so every containment check below compares real
  // paths, not lexical ones.
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

    const parent = dirname(dest);
    mkdirSync(parent, { recursive: true });

    // Symlink guard. The lexical check above only proves the *name* stays
    // under the target; it says nothing about what the path resolves to on
    // disk. If `storage/documents` (or any parent) is a symlink, `writeFileSync`
    // follows it and lands the entry anywhere the process can write — the
    // arbitrary-file-overwrite class of bug (GHSA-vwc7-r8mq-g2x9 in adm-zip,
    // which applies equally to a hand-rolled writer). Refuse the whole part
    // rather than skipping one entry, so the operator gets a clear failure
    // instead of a half-applied restore.
    if (realpathSync(parent) !== realTarget && !realpathSync(parent).startsWith(realTarget + sep)) {
      throw new UserFacingError(
        "تعذّرت الاستعادة: مسار المجلد الهدف يحتوي على رابط رمزي (symlink) — تحقّق من مجلد النسخ الاحتياطي"
      );
    }
    if (existsSync(dest) && lstatSync(dest).isSymbolicLink()) {
      throw new UserFacingError(
        "تعذّرت الاستعادة: الملف موجود كرابط رمزي (symlink) — تحقّق من مجلد النسخ الاحتياطي"
      );
    }

    writeFileSync(dest, entry.getData());
  }
}

/**
 * Stage the database part as *.pending files next to the live DB. Returns
 * true when at least the main edms.db was staged. The live files are never
 * touched — the boot hook swaps pending → live before the server starts.
 */
function stageDatabasePending(
  zip: InstanceType<typeof AdmZip>,
  dataDir: string
): boolean {
  const map: Record<string, string> = {
    "database/edms.db": "edms.db.pending",
    "database/edms.db-wal": "edms.db.pending-wal",
    "database/edms.db-shm": "edms.db.pending-shm",
  };
  let stagedMain = false;
  mkdirSync(dataDir, { recursive: true });
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, "/");
    const pendingName = map[name];
    if (!pendingName) continue;
    writeFileSync(join(dataDir, pendingName), entry.getData());
    if (pendingName === "edms.db.pending") stagedMain = true;
  }
  return stagedMain;
}