import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server";
import { makeScanSvg } from "@/lib/doc-svg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

/**
 * "محاكاة مسح" — tries the real WIA hardware scanner first (same as
 * /api/scan/hardware with default settings); when no scanner is connected
 * (or scanning fails for any reason) it falls back to a generated sample
 * page so the simulation button ALWAYS produces a page. The response carries
 * `simulated: true` in the fallback case so the UI can label it honestly.
 *
 * Authenticated like every other /api route — an anonymous caller gets 401.
 * Returns `{ image, docNumber, simulated }`.
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
    if (!stdout.includes("NO_SCANNER")) {
      const buf = await readFile(out);
      await unlink(out).catch(() => {});
      return NextResponse.json({
        image: `data:image/jpeg;base64,${buf.toString("base64")}`,
        docNumber: "",
        simulated: false,
      });
    }
    await unlink(out).catch(() => {});
  } catch {
    await unlink(out).catch(() => {});
    // Hardware unavailable — fall through to the generated sample below.
  }

  // Fallback: generated sample page (offline, no hardware needed).
  const n = Math.floor(Math.random() * 9000) + 1000;
  const docNumber = `SIM-${new Date().getFullYear()}-${n}`;
  const svg = makeScanSvg({
    title: "صفحة تجريبية من محاكاة المسح",
    docNumber,
    department: "تقنية المعلومات",
    kind: "memo",
    body: [
      "هذه صفحة تجريبية مولّدة محلياً لغرض اختبار مسار المسح الضوئي دون الحاجة إلى ماسح متصل.",
      "عند توصيل طابعة أو ماسح ضوئي سيُستخدم الجهاز الحقيقي تلقائياً بدل هذه العينة.",
    ],
  });
  return NextResponse.json({
    image: `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`,
    docNumber,
    simulated: true,
  });
}
