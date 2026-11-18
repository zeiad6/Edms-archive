"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Database,
  Download,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui";
import { formatBytes, formatDate, cn } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

interface SnapshotEntry {
  name: string;
  size: number;
  createdAt: string;
  version: string;
}

interface SystemUpgradeState {
  appVersion: string;
  schemaVersion: number;
  targetSchemaVersion: number;
  integrityOk: boolean;
  foreignKeyViolations: number;
  snapshots: SnapshotEntry[];
}

export function SystemUpgradeCard({ initialData }: { initialData?: SystemUpgradeState }) {
  useLang();
  const [data, setData] = useState<SystemUpgradeState | null>(initialData ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/system/snapshots");
      if (!res.ok) return;
      const json = await res.json();
      if (json?.ok) {
        setData(json);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      void loadStatus();
    }
  }, [initialData, loadStatus]);

  async function handleCreateSnapshot() {
    setBusy("create");
    setNotice(null);
    try {
      const res = await fetch("/api/system/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "فشل إنشاء اللقطة الاحتياطية");
      }
      setData((prev) => (prev ? { ...prev, snapshots: json.snapshots || [] } : prev));
      setNotice({ kind: "ok", text: t("تم إنشاء لقطة احتياطية ذرية نظيفة لقاعدة البيانات بنجاح") });
    } catch (e) {
      setNotice({
        kind: "err",
        text: e instanceof Error ? t(e.message) : t("تعذّر إنشاء اللقطة الاحتياطية"),
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleRestoreSnapshot(name: string) {
    if (!confirm(t("هل تريد استعادة هذه اللقطة الاحتياطية؟ سيتم أخذ نسخة أمان من البيانات الحالية أولاً وتطبيق الاستعادة عند إعادة تشغيل التطبيق."))) {
      return;
    }
    setBusy(`restore:${name}`);
    setNotice(null);
    try {
      const res = await fetch("/api/system/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", name }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "فشلت جدولة استعادة اللقطة");
      }
      setNotice({
        kind: "ok",
        text: t("تم تجهيز اللقطة للاستعادة بنجاح — أعد تشغيل التطبيق لتفعيلها"),
      });
      await loadStatus();
    } catch (e) {
      setNotice({
        kind: "err",
        text: e instanceof Error ? t(e.message) : t("فشلت استعادة اللقطة"),
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="card-sheen p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2.5 text-sm font-bold text-foreground">
            <span className="icon-tile h-8 w-8 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 [&_svg]:h-4 [&_svg]:w-4">
              <ShieldCheck className="h-4 w-4" />
            </span>
            {t("حالة النظام والترقيات والنسخ التلقائية")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("يأخذ النظام لقطة ذرية نظيفة (pre-upgrade snapshot) تلقائياً قبل أي ترقية لضمان عدم فقدان أي بيانات مع إمكانية التراجع الفوري.")}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateSnapshot}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-soft transition hover:border-primary/30 hover:bg-muted disabled:opacity-60"
        >
          {busy === "create" ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          )}
          {t("أخذ لقطة فورية الآن")}
        </button>
      </div>

      {/* Schema & Integrity KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
          <div className="text-[11px] text-muted-foreground">{t("إصدار التطبيق والمخطط")}</div>
          <div className="mt-1 font-mono text-sm font-bold text-foreground" dir="ltr">
            v{data?.appVersion ?? "1.0.7"} · Schema v{data?.schemaVersion ?? 3}/{data?.targetSchemaVersion ?? 3}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
          <div className="text-[11px] text-muted-foreground">{t("سلامة قاعدة البيانات (Integrity)")}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {data?.integrityOk !== false ? t("سليمة 100% (OK)") : t("بحاجة لفحص")}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
          <div className="text-[11px] text-muted-foreground">{t("اللقطات التلقائية المحفوظة")}</div>
          <div className="mt-1 tnum text-sm font-bold text-foreground">
            {data?.snapshots.length ?? 0} / 5
          </div>
        </div>
      </div>

      {/* Pre-upgrade snapshots list */}
      <div>
        <div className="mb-2.5 text-xs font-bold text-foreground">
          {t("اللقطات الاحتياطية التلقائية قبل التحديثات (pre-upgrade snapshots)")}
        </div>

        {!data || data.snapshots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">
            {t("لا توجد لقطات ترقية سابقة حتى الآن — تُنشأ اللقطات تلقائياً عند الترقية أو بالضغط على «أخذ لقطة فورية الآن».")}
          </div>
        ) : (
          <div className="space-y-2">
            {data.snapshots.map((snap) => (
              <div
                key={snap.name}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Database className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate font-mono font-semibold text-foreground" dir="ltr">
                      {snap.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatBytes(snap.size)} · {formatDate(snap.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={`/api/system/snapshots?download=${encodeURIComponent(snap.name)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t("تنزيل")}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRestoreSnapshot(snap.name)}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {busy === `restore:${snap.name}` ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    {t("استعادة")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className={cn(
            "mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ring-1 ring-inset",
            notice.kind === "ok"
              ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400"
              : "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-400",
          )}
        >
          {notice.kind === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}
    </Card>
  );
}
