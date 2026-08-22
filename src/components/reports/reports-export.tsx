"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ReportDef {
  type: string;
  label: string;
  className: string;
}

const REPORTS: ReportDef[] = [
  { type: "depts", label: "الأقسام", className: "bg-primary text-primary-foreground hover:opacity-90" },
  { type: "users", label: "المستخدمون", className: "bg-primary text-primary-foreground hover:opacity-90" },
  { type: "types", label: "أنواع المستندات", className: "bg-emerald-600 text-white hover:opacity-90" },
  { type: "status", label: "حالة المستندات", className: "bg-amber-600 text-white hover:opacity-90" },
  { type: "folders", label: "المجلدات", className: "bg-violet-600 text-white hover:opacity-90" },
  { type: "documents", label: "جميع المستندات", className: "bg-rose-600 text-white hover:opacity-90" },
];

/** Extracts the server-provided filename (RFC 5987 or plain) from Content-Disposition. */
function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename\*=UTF-8''([^;]+)/i.exec(header) || /filename="?([^";]+)"?/i.exec(header);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function ReportsExport() {
  const [busy, setBusy] = useState<string | null>(null);

  async function downloadReport(report: ReportDef) {
    setBusy(report.type);
    try {
      const res = await fetch(`/api/reports/export?type=${report.type}`);
      if (!res.ok) {
        // The API replies with plain-text errors — also handle JSON for safety.
        let message = "";
        try {
          const json = await res.json();
          if (typeof json?.error === "string") message = json.error;
        } catch {
          message = await res.text().catch(() => "");
        }
        throw new Error(message || `فشل تنزيل التقرير (رمز ${res.status})`);
      }
      const blob = await res.blob();
      const filename = filenameFromDisposition(
        res.headers.get("Content-Disposition"),
        `${report.label}.csv`,
      );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      // Deferred cleanup — revoking synchronously can cancel the download.
      setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
      }, 1000);
      toast.success(`تم تنزيل التقرير: ${report.label}`);
    } catch (e) {
      toast.error(`فشل تنزيل التقرير: ${e instanceof Error ? e.message : "خطأ غير متوقع"}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-bold text-foreground">تصدير التقارير (CSV)</h3>
      <div className="flex flex-wrap gap-3">
        {REPORTS.map((report) => (
          <button
            key={report.type}
            type="button"
            onClick={() => downloadReport(report)}
            disabled={busy !== null}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${report.className}`}
          >
            {busy === report.type ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {report.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        الملفات بتنسيق CSV مع تشفير UTF-8 — متوافقة مع Excel و LibreOffice.
      </p>
    </Card>
  );
}