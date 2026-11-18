import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getCurrentUser, logAudit } from "@/lib/server";
import { can } from "@/lib/permissions";
import { APP_VERSION } from "@/lib/version";
import {
  TARGET_SCHEMA_VERSION,
  createPreUpgradeSnapshot,
  getSchemaUserVersion,
  listPreUpgradeSnapshots,
  readRecordedAppVersion,
  resolveDataPaths,
  verifyDatabaseIntegrity,
} from "@/lib/upgrade-engine";
import { isValidSqliteFormat } from "@/app/api/restore/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAFE_SNAPSHOT_NAME = /^edms-pre-v[a-zA-Z0-9._-]+\.db$/;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "settings.manage")) {
    return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 403 });
  }

  const downloadName = request.nextUrl.searchParams.get("download");
  if (downloadName) {
    if (!SAFE_SNAPSHOT_NAME.test(downloadName)) {
      return NextResponse.json({ ok: false, error: "اسم ملف اللقطة غير صالح" }, { status: 400 });
    }
    const { backupsDir } = resolveDataPaths();
    const targetPath = path.join(backupsDir, downloadName);
    if (!existsSync(targetPath)) {
      return NextResponse.json({ ok: false, error: "اللقطة غير موجودة" }, { status: 404 });
    }
    const size = statSync(targetPath).size;
    const stream = Readable.toWeb(createReadStream(targetPath)) as ReadableStream<Uint8Array>;
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Length": String(size),
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const [schemaVersion, recordedApp, snapshots, integrity] = await Promise.all([
    getSchemaUserVersion(),
    readRecordedAppVersion(),
    listPreUpgradeSnapshots(),
    verifyDatabaseIntegrity({ enforceForeignKeys: false }).catch(() => ({
      integrityOk: false,
      foreignKeyViolations: -1,
    })),
  ]);

  return NextResponse.json({
    ok: true,
    appVersion: APP_VERSION,
    schemaVersion,
    targetSchemaVersion: TARGET_SCHEMA_VERSION,
    integrityOk: integrity.integrityOk,
    foreignKeyViolations: integrity.foreignKeyViolations,
    recordedApp,
    snapshots: snapshots.map((s) => ({
      name: s.name,
      size: s.size,
      createdAt: s.createdAt,
      version: s.version,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "settings.manage")) {
    return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 403 });
  }

  let body: { action?: string; name?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "طلب غير صالح" }, { status: 400 });
  }

  if (body.action === "create") {
    const snapPath = await createPreUpgradeSnapshot(APP_VERSION);
    if (!snapPath) {
      return NextResponse.json({ ok: false, error: "تعذّر إنشاء لقطة احتياطية" }, { status: 500 });
    }
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "system.snapshot_create",
      entityType: "system",
      details: `إنشاء لقطة ترقية احتياطية: ${path.basename(snapPath)}`,
    });
    const snapshots = await listPreUpgradeSnapshots();
    return NextResponse.json({
      ok: true,
      created: path.basename(snapPath),
      snapshots: snapshots.map((s) => ({
        name: s.name,
        size: s.size,
        createdAt: s.createdAt,
        version: s.version,
      })),
    });
  }

  if (body.action === "restore") {
    const name = String(body.name || "").trim();
    if (!SAFE_SNAPSHOT_NAME.test(name)) {
      return NextResponse.json({ ok: false, error: "اسم اللقطة غير صالح" }, { status: 400 });
    }
    const { dataDir, backupsDir } = resolveDataPaths();
    const targetPath = path.join(backupsDir, name);
    if (!existsSync(targetPath)) {
      return NextResponse.json({ ok: false, error: "ملف اللقطة غير موجود" }, { status: 404 });
    }

    const bytes = readFileSync(targetPath);
    if (!isValidSqliteFormat(bytes)) {
      return NextResponse.json({ ok: false, error: "ملف اللقطة ليس قاعدة بيانات SQLite 3 صالحة" }, { status: 400 });
    }

    // Create a safety snapshot before staging the restore
    await createPreUpgradeSnapshot("before-snapshot-restore").catch(() => null);

    // Clear stale WAL/SHM and stage edms.db.pending for next boot
    rmSync(path.join(dataDir, "edms.db.pending-wal"), { force: true });
    rmSync(path.join(dataDir, "edms.db.pending-shm"), { force: true });
    rmSync(path.join(dataDir, "edms.db-wal"), { force: true });
    rmSync(path.join(dataDir, "edms.db-shm"), { force: true });
    writeFileSync(path.join(dataDir, "edms.db.pending"), bytes);
    writeFileSync(
      path.join(dataDir, "restore-pending.json"),
      JSON.stringify(
        {
          parts: ["database"],
          configPath: null,
          pendingDb: dataDir,
          fromSnapshot: name,
        },
        null,
        2,
      ),
    );

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "system.snapshot_restore",
      entityType: "system",
      details: `جدولة استعادة لقطة ترقية: ${name}`,
    });

    return NextResponse.json({
      ok: true,
      pendingRestart: true,
      restored: name,
    });
  }

  return NextResponse.json({ ok: false, error: "إجراء غير مدعوم" }, { status: 400 });
}
