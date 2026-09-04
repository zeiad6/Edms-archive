import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server";
import { parseWiaDeviceList } from "@/lib/scanner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

/**
 * Lists WIA scanners physically connected to this machine (USB / network /
 * multi-function printer) via `scripts/scan-wia.ps1 -ListOnly`.
 *
 * Authenticated like every other /api route — anonymous callers get 401.
 * Returns `{ devices: [{ index, deviceId, name }] }` (empty when none).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const script = process.env.EDMS_SCRIPTS_DIR
    ? path.join(process.env.EDMS_SCRIPTS_DIR, "scan-wia.ps1")
    : path.join(process.cwd(), "scripts", "scan-wia.ps1");
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", script, "-ListOnly"],
      { timeout: 30_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );
    return NextResponse.json({ devices: parseWiaDeviceList(stdout) });
  } catch (e) {
    const code = (e as { code?: unknown })?.code;
    // Exit 2 = enumerated successfully, simply no scanner connected.
    if (code === 2) return NextResponse.json({ devices: [] });
    if (code === 3) {
      return NextResponse.json(
        { error: "خدمة المسح الضوئي (WIA) غير متوفرة على هذا النظام" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "تعذر سرد أجهزة المسح — تحقق من توصيل الطابعة/الماسح" },
      { status: 500 },
    );
  }
}
