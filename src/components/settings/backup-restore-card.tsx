"use client";

import { useCallback, useRef, useState } from "react";
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileArchive,
} from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { t } from "@/lib/i18n";
import { Card } from "@/components/ui";
import { cn, formatBytes } from "@/lib/format";

interface PartInfo {
  id: string;
  name: string;
  size: number;
  count: number;
}

interface RestoreResponse {
  ok: boolean;
  needSelection?: boolean;
  manifest?: { parts: PartInfo[] };
  applied?: string[];
  pendingRestart?: string[];
  error?: string;
}

type BusyState = null | "backup" | "check" | "restore";

type Status = { kind: "ok" | "err"; text: string } | null;

/**
 * Backup & restore control card (client component — the settings page is
 * server-rendered, so the interactive parts live here).
 *
 * Backup: fetch /api/backup → blob → object-URL download (reliable filename
 * + binary handling vs a plain <a download>).
 *
 * Restore: two-phase — phase 1 POSTs just the zip to /api/restore which
 * validates it and returns the manifest parts (no client-side zip parsing);
 * phase 2 POSTs the zip again with the user's selectedParts[].
 */
export function BackupRestoreCard() {
  useLang(); // re-render when the language toggles
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [parts, setParts] = useState<PartInfo[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const doBackup = useCallback(async () => {
    setBusy("backup");
    setStatus(null);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="?([^";]+)"?/);
      const filename = m ? m[1] : "edms-backup.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus({ kind: "ok", text: t("تم إنشاء النسخة الاحتياطية بنجاح") });
    } catch {
      setStatus({ kind: "err", text: t("فشل إنشاء النسخة الاحتياطية") });
    } finally {
      setBusy(null);
    }
  }, []);

  const onFileSelected = useCallback(async (file: File) => {
    if (!file) return;
    setSelectedFile(file);
    setParts(null);
    setChecked(new Set());
    setStatus(null);
    setBusy("check");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/restore", { method: "POST", body: fd });
      const data = (await res.json()) as RestoreResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || t("فشل تحليل ملف النسخة الاحتياطية"));
      }
      const list = data.manifest?.parts ?? [];
      if (list.length === 0) {
        throw new Error(t("لا توجد أجزاء قابلة للاستعادة في الملف"));
      }
      setParts(list);
      setChecked(new Set(list.map((p) => p.id)));
    } catch (e) {
      setStatus({
        kind: "err",
        text: e instanceof Error ? t(e.message) : t("فشل تحليل ملف النسخة الاحتياطية"),
      });
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(null);
    }
  }, []);

  const doRestore = useCallback(async () => {
    if (!selectedFile || checked.size === 0) {
      setStatus({ kind: "err", text: t("لم يتم اختيار أي جزء للاستعادة") });
      return;
    }
    setBusy("restore");
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      for (const id of checked) fd.append("selectedParts", id);
      const res = await fetch("/api/restore", { method: "POST", body: fd });
      const data = (await res.json()) as RestoreResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || t("فشلت الاستعادة"));
      }
      const needsRestart = (data.pendingRestart ?? []).length > 0;
      setStatus({
        kind: "ok",
        text: t("تمت الاستعادة بنجاح") +
          (needsRestart ? ` — ${t("سيتم تطبيق قاعدة البيانات والإعدادات بعد إعادة تشغيل التطبيق")}` : ""),
      });
      setParts(null);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setStatus({
        kind: "err",
        text: e instanceof Error ? t(e.message) : t("فشلت الاستعادة"),
      });
    } finally {
      setBusy(null);
    }
  }, [selectedFile, checked]);

  function togglePart(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const busyLabel =
    busy === "backup"
      ? t("جاري إنشاء النسخة الاحتياطية…")
      : busy === "check"
        ? t("جاري تحليل الملف…")
        : busy === "restore"
          ? t("جاري الاستعادة…")
          : null;

  return (
    <Card className="card-sheen p-5 sm:p-6">
      <h3 className="mb-2 flex items-center gap-2.5 text-sm font-bold text-foreground">
        <span className="icon-tile h-8 w-8 bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4"><Download className="h-4 w-4" /></span> {t("النسخ الاحتياطي والاستعادة")}
      </h3>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">
        {t(
          "ينزّل ملف ZIP واحداً يحتوي قاعدة البيانات بالكامل وكل ملفات التخزين (المستندات والصور الممسوحة) مع ملف وصف (manifest) — احفظه على جهازك أو وسيط خارجي للاستعادة عند الحاجة."
        )}
      </p>

      {/* ---- Create backup -------------------------------------------------- */}
      <button
        type="button"
        onClick={doBackup}
        disabled={busy !== null}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all duration-150 hover:-translate-y-px hover:bg-primary/90 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy === "backup" ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {t("إنشاء نسخة احتياطية")}
      </button>

      {/* ---- Restore --------------------------------------------------------- */}
      <div className="mt-5 border-t border-border pt-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="icon-tile h-7 w-7 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 [&_svg]:h-3.5 [&_svg]:w-3.5"><Upload className="h-3.5 w-3.5" /></span> {t("استعادة نسخة احتياطية")}
        </h4>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition hover:border-primary/30 hover:bg-muted hover:shadow-card active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
          <FileArchive className="h-4 w-4" />
          {t("اختيار ملف ZIP")}
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            disabled={busy !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFileSelected(f);
            }}
          />
        </label>

        {selectedFile && (
          <div className="mt-3 text-xs text-muted-foreground">
            <span dir="ltr" className="tnum">{selectedFile.name}</span> ·{" "}
            {formatBytes(selectedFile.size)}
          </div>
        )}

        {parts && parts.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold text-foreground">
              {t("اختر الأجزاء المطلوب استعادتها:")}
            </div>
            <div className="space-y-1.5">
              {parts.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2.5 text-sm text-foreground shadow-soft ring-1 ring-inset ring-border/40 transition hover:bg-muted hover:shadow-card"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(p.id)}
                    onChange={() => togglePart(p.id)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="flex-1 font-medium">{t(p.name || p.id)}</span>
                  <span className="text-[11px] text-muted-foreground tnum">
                    {formatBytes(p.size)} · {p.count} {t("ملف")}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {t("ملاحظة: استعادة قاعدة البيانات والإعدادات تتطلب إعادة تشغيل التطبيق")}
            </p>
            <button
              type="button"
              onClick={doRestore}
              disabled={busy !== null || checked.size === 0}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition-all duration-150 hover:-translate-y-px hover:bg-emerald-500 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "restore" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t("استعادة الأجزاء المحددة")}
            </button>
          </div>
        )}

        {busyLabel && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> {busyLabel}
          </div>
        )}

        {status && (
          <div
            className={cn(
              "mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium shadow-soft ring-1 ring-inset",
              status.kind === "ok"
                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-400"
            )}
            role="status"
          >
            {status.kind === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>{status.text}</span>
          </div>
        )}
      </div>
    </Card>
  );
}