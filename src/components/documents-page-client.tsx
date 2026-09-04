"use client";

import { useState, useEffect } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Tag,
  Trash2,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import { DocumentsGrid, type DocRow } from "@/components/grids/documents-grid";
import { toast } from "sonner";
import { STATUS_META } from "@/lib/format";
import { useRouter } from "next/navigation";

interface TagItem {
  id: number;
  name: string;
  color: string;
}

export function DocumentsPageClient({ rows }: { rows: DocRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<DocRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagsError, setTagsError] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tags")
      .then((r) => {
        if (!r.ok) throw new Error(`tags request failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setTags(data || []);
      })
      .catch((e) => {
        console.error("تعذّر تحميل الوسوم:", e);
        if (!cancelled) setTagsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ids = selected.map((r) => r.id);

  async function handleBulkDownload() {
    if (selected.length === 0) {
      toast.error("اختر مستنداً واحداً على الأقل أولاً");
      return;
    }
    setBusy("download");
    try {
      const res = await fetch("/api/documents/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "فشل التحميل" }));
        throw new Error(err.error || "فشل التحميل");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents-bulk-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revocation — revoking synchronously can abort the download in Firefox.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`تم تحميل ${selected.length} مستند${selected.length === 1 ? "" : "اً"} بنجاح`);
      setSelected([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التحميل المجمع");
    } finally {
      setBusy(null);
    }
  }

  async function handleExportSelected() {
    if (selected.length === 0) {
      toast.error("اختر مستنداً واحداً على الأقل أولاً");
      return;
    }
    setBusy("export");
    try {
      const res = await fetch("/api/documents/export-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "فشل التصدير" }));
        throw new Error(err.error || "فشل التصدير");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents-export-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revocation — revoking synchronously can abort the download in Firefox.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`تم تصدير ${selected.length} مستند${selected.length === 1 ? "" : "اً"} مع كشف Excel`);
      setSelected([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التصدير مع الكشف");
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkDelete() {
    if (ids.length === 0) return;
    setBusy("delete");
    try {
      const res = await fetch("/api/documents/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل");
      toast.success(`نقل ${ids.length} مستند إلى السلة`);
      setSelected([]);
      setDeleteOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف المجمع");
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkStatus(status: string) {
    if (ids.length === 0) return;
    setBusy("status");
    try {
      const res = await fetch("/api/documents/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", ids, status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل");
      toast.success(`تحديث حالة ${ids.length} مستند`);
      setSelected([]);
      setStatusOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحديث الحالة");
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkTag(tagId: number) {
    if (ids.length === 0) return;
    setBusy("tag");
    try {
      const res = await fetch("/api/documents/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tag", ids, tagId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل");
      toast.success(`إضافة الوسم إلى ${ids.length} مستند`);
      setSelected([]);
      setTagOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل إضافة الوسم");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Bulk actions toolbar — unmounted from layout when nothing is
          selected so the grid gets the full viewport height (no phantom
          ~52px strip); fades in on first selection. */}
      <div
        className={`z-10 mb-2 flex shrink-0 items-center justify-between rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-xl transition-all duration-200 ${
          selected.length > 0
            ? "border-indigo-200 bg-indigo-50/90 animate-fadein dark:border-indigo-800 dark:bg-indigo-950/40"
            : "hidden"
        }`}
      >
        <span className="text-sm font-medium text-foreground">
          <ListChecks className="me-1.5 inline h-4 w-4 text-indigo-500" />
          {selected.length} مستند{" "}
          {selected.length === 1 ? "مُحدد" : selected.length <= 10 ? "مُحددة" : "مُحدد"}
        </span>
        <div className="flex items-center gap-1.5">
          {/* Tag */}
          <div className="relative">
            <button
              onClick={() => setTagOpen(!tagOpen)}
              disabled={busy === "tag"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-muted disabled:opacity-60 dark:bg-indigo-950/60"
            >
              {busy === "tag" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
              وسم
            </button>
            {tagOpen && (
              <div className="absolute bottom-full start-0 mb-2 w-52 rounded-xl border border-border bg-card shadow-xl">
                <div className="border-b border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                  اختر الوسم
                </div>
                <div className="max-h-48 overflow-y-auto p-1.5">
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleBulkTag(t.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground transition hover:bg-muted"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.name}
                    </button>
                  ))}
                  {tagsError ? (
                    <p className="px-2.5 py-3 text-xs text-rose-500">تعذّر تحميل الوسوم</p>
                  ) : tags.length === 0 ? (
                    <p className="px-2.5 py-3 text-xs text-muted-foreground">لا توجد وسوم</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="relative">
            <button
              onClick={() => setStatusOpen(!statusOpen)}
              disabled={busy === "status"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-muted disabled:opacity-60 dark:bg-indigo-950/60"
            >
              {busy === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              حالة
            </button>
            {statusOpen && (
              <div className="absolute bottom-full start-0 mb-2 w-48 rounded-xl border border-border bg-card shadow-xl">
                <div className="border-b border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                  تغيير الحالة إلى
                </div>
                <div className="p-1.5">
                  {(["active", "pending_review", "archived", "draft"] as const).map((s) => {
                    const m = STATUS_META[s];
                    return (
                      <button
                        key={s}
                        onClick={() => handleBulkStatus(s)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground transition hover:bg-muted"
                      >
                        <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Delete */}
          <div className="relative">
            <button
              onClick={() => setDeleteOpen(!deleteOpen)}
              disabled={busy === "delete"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-rose-600 shadow-sm ring-1 ring-border transition hover:bg-rose-50 disabled:opacity-60 dark:bg-indigo-950/60"
            >
              {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              حذف
            </button>
            {deleteOpen && (
              <div className="absolute bottom-full start-0 mb-2 w-56 rounded-xl border border-border bg-card p-3 shadow-xl">
                <p className="text-xs text-foreground">
                  نقل <strong>{ids.length}</strong> مستند إلى سلة المحذوفات؟
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleBulkDelete}
                    className="flex-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                  >
                    نقل للسلة
                  </button>
                  <button
                    onClick={() => setDeleteOpen(false)}
                    className="flex-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-border"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Download */}
          <button
            onClick={handleBulkDownload}
            disabled={busy === "download"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {busy === "download" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            ZIP
          </button>

          {/* Export: ZIP + Excel manifest — emerald/teal glow identity */}
          <button
            onClick={handleExportSelected}
            disabled={busy === "export"}
            title="تنزيل ZIP فيه الملفات + كشف Excel (غلاف EDMS، روابط تفتح داخل الحزمة)"
            aria-busy={busy === "export"}
            aria-label="تصدير ZIP مع كشف Excel"
            className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-[0_0_18px_-4px_rgba(16,185,129,0.7)] ring-1 ring-emerald-300/40 transition hover:from-emerald-500 hover:to-teal-500 hover:shadow-[0_0_24px_-4px_rgba(16,185,129,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
          >
            {busy === "export" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 transition group-hover:scale-110" />
            )}
            {busy === "export" ? "جارٍ تجهيز الكشف…" : "ZIP + كشف"}
          </button>
        </div>
      </div>

      <div className="documents-grid-area relative min-h-[200px]">
        <DocumentsGrid rows={rows} onSelectionChange={setSelected} />
      </div>
    </div>
  );
}

/**
 * CSV export button for the documents filter form. The page itself is a
 * Server Component (can't use sonner hooks), so the download lives here:
 * fetch the same endpoint the old <a download> pointed at, stream it as a
 * blob, and surface success/failure via toasts.
 */
export function CsvExportButton() {
  const [busy, setBusy] = useState(false);

  async function handleExportCsv() {
    setBusy(true);
    try {
      const res = await fetch("/api/reports/export?type=documents");
      if (!res.ok) throw new Error(`فشل التصدير (${res.status})`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      let filename = `documents-${new Date().toISOString().slice(0, 10)}.csv`;
      const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
      const plain = /filename="?([^";]+)"?/i.exec(cd);
      if (star?.[1]) filename = decodeURIComponent(star[1]);
      else if (plain?.[1]) filename = plain[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revocation — revoking synchronously can abort the download in Firefox.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("تم تصدير كشف CSV بنجاح");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تصدير CSV");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExportCsv}
      disabled={busy}
      aria-busy={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? "جارٍ التصدير…" : "تصدير CSV"}
    </button>
  );
}
