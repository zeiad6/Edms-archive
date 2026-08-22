import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

/**
 * Scans a page from a WIA scanner physically connected to this machine
 * (USB / network / multi-function printer). Uses the built-in Windows WIA
 * COM API via a PowerShell script — real hardware scanning, no SDKs.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const out = path.join(tmpdir(), `edms-wia-${Date.now()}.jpg`);
  // The Electron shell sets EDMS_SCRIPTS_DIR (the packaged script lives in
  // resources next to the app; inside an asar it is not directly executable).
  // Mirror of /api/scan/route.ts — never rely on process.cwd() in the
  // packaged app, where the Next standalone server runs from resources/standalone.
  const script = process.env.EDMS_SCRIPTS_DIR
    ? path.join(process.env.EDMS_SCRIPTS_DIR, "scan-wia.ps1")
    : path.join(process.cwd(), "scripts", "scan-wia.ps1");
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", script, out],
      { timeout: 90_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );
    const buf = await readFile(out);
    await unlink(out).catch(() => {});
    return NextResponse.json({
      image: `data:image/jpeg;base64,${buf.toString("base64")}`,
      docNumber: "",
    });
  } catch (e) {
    // scan-wia.ps1 exit codes: 0 = OK, 1 = scan failed, 2 = no scanner found
    // (WIA Type-1 device), 3 = WIA COM unavailable. execFile rejects on any
    // non-zero exit and sets err.code to the process exit code, so the
    // stdout markers ("NO_SCANNER", …) are never visible on the resolved path.
    const code = (e as { code?: unknown })?.code;
    if (code === 2) {
      return NextResponse.json(
        { error: "لم يتم العثور على ماسح ضوئي متصل بالجهاز" },
        { status: 422 },
      );
    }
    if (code === 3) {
      return NextResponse.json(
        { error: "خدمة المسح الضوئي (WIA) غير متوفرة على هذا النظام" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "تعذر إجراء المسح الضوئي — تحقق من توصيل الطابعة/الماسح" },
      { status: 500 },
    );
  }
}
