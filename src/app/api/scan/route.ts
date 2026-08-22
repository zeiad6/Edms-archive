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
 * Scans one page from the WIA scanner physically connected to this machine
 * (USB / network / multi-function printer). No mock or generated samples:
 * this endpoint drives the real hardware scanner through the built-in
 * Windows WIA COM API (scripts/scan-wia.ps1).
 *
 * Authenticated like every other /api route — an anonymous caller gets 401.
 * Returns the same contract as /api/scan/hardware: { image, docNumber }.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const out = path.join(tmpdir(), `edms-wia-${Date.now()}.jpg`);
  // The Electron shell sets EDMS_SCRIPTS_DIR (the packaged script lives in
  // resources next to the app; inside an asar it is not directly executable).
  const script = process.env.EDMS_SCRIPTS_DIR
    ? path.join(process.env.EDMS_SCRIPTS_DIR, "scan-wia.ps1")
    : path.join(process.cwd(), "scripts", "scan-wia.ps1");
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", script, out],
      { timeout: 90_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );
    if (stdout.includes("NO_SCANNER")) {
      return NextResponse.json(
        { error: "لم يتم العثور على ماسح ضوئي متصل بالجهاز. تأكد من توصيله وتشغيله." },
        { status: 500 },
      );
    }
    const buf = await readFile(out);
    await unlink(out).catch(() => {});
    return NextResponse.json({
      image: `data:image/jpeg;base64,${buf.toString("base64")}`,
      docNumber: "",
    });
  } catch {
    return NextResponse.json(
      { error: "تعذر إجراء المسح من الماسح الضوئي المتصل بالجهاز." },
      { status: 500 },
    );
  }
}
