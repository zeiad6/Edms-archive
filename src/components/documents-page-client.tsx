"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Tag,
  Trash2,
  CheckCircle2,
  ListChecks,
  Search,
  X,
  Lock,
  LayoutGrid,
  Table2,
  Eye,
  FileText,
  History,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { DocumentsGrid, type DocRow } from "@/components/grids/documents-grid";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { STATUS_META, docTypeStyle, formatBytes, formatDate, cn } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";
import { useRouter } from "next/navigation";

interface TagItem {
  id: number;
  name: string;
  color: string;
}

interface QuickPreviewSummary {
  document: {
    id: number;
    title: string;
    description: string | null;
    docNumber: string | null;
    docType: string | null;
    status: string;
    confidential: boolean;
    fileSize: number;
    fileExt: string | null;
    mimeType: string;
    pageCount: number | null;
    version: number;
    docDate: string | null;
    keywords: string | null;
    source: string | null;
    createdAt: string;
    updatedAt: string;
    departmentName: string | null;
    departmentColor: string | null;
    folderName: string | null;
    uploaderName: string | null;
    ocrSnippet: string;
  };
  tags: Array<{ id: number; name: string; color: string }>;
  versions: Array<{
    id: number;
    version: number;
    originalName: string;
    fileSize: number;
    note: string | null;
    createdAt: string;
    uploaderName: string | null;
  }>;
  approvals: Array<{
    id: number;
    status: string;
    comment: string | null;
    responseNote: string | null;
    respondedAt: string | null;
    createdAt: string;
    approverName: string | null;
  }>;
}

export function DocumentsPageClient({ rows }: { rows: DocRow[] }) {
  useLang(); // re-render on language toggle
  const router = useRouter();
  const [selected, setSelected] = useState<DocRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagsError, setTagsError] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [previewDoc, setPreviewDoc] = useState<DocRow | null>(null);
  const [previewData, setPreviewData] = useState<QuickPreviewSummary | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  // Load summary details when Quick Preview Drawer opens
  useEffect(() => {
    if (!previewDoc) {
      setPreviewData(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    fetch(`/api/documents/${previewDoc.id}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok) {
          setPreviewData(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewDoc]);

  const ids = selected.map((r) => r.id);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [clientSearch, setClientSearch] = useState<string>("");

  const counts = useMemo(() => {
    let active = 0;
    let pending = 0;
    let archived = 0;
    let draft = 0;
    let confidential = 0;
    for (const r of rows) {
      if (r.status === "active") active++;
      else if (r.status === "pending_review") pending++;
      else if (r.status === "archived") archived++;
      else if (r.status === "draft") draft++;
      if (r.confidential) confidential++;
    }
    return { all: rows.length, active, pending, archived, draft, confidential };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (activeFilter === "confidential") {
        if (!r.confidential) return false;
      } else if (activeFilter !== "all") {
        if (r.status !== activeFilter) return false;
      }

      if (clientSearch.trim()) {
        const q = clientSearch.toLowerCase().trim();
        const titleMatch = r.title.toLowerCase().includes(q);
        const docNumMatch = r.docNumber?.toLowerCase().includes(q) ?? false;
        const typeMatch = r.docType?.toLowerCase().includes(q) ?? false;
        const deptMatch = r.departmentName?.toLowerCase().includes(q) ?? false;
        if (!titleMatch && !docNumMatch && !typeMatch && !deptMatch) return false;
      }

      return true;
    });
  }, [rows, activeFilter, clientSearch]);

  function toggleCardSelection(row: DocRow) {
    setSelected((prev) =>
      prev.some((s) => s.id === row.id)
        ? prev.filter((s) => s.id !== row.id)
        : [...prev, row]
    );
  }

  async function handleBulkDownload() {
    if (selected.length === 0) {
      toast.error(t("اختر مستنداً واحداً على الأقل أولاً"));
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
        throw new Error(t(err.error || "فشل التحميل"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents-bulk-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t("تم تحميل {n} مستند بنجاح", { n: selected.length }));
      setSelected([]);
    } catch (e) {
      toast.error(e instanceof Error ? t(e.message) : t("تعذّر التحميل المجمع"));
    } finally {
      setBusy(null);
    }
  }

  async function handleExportSelected() {
    if (selected.length === 0) {
      toast.error(t("اختر مستنداً واحداً على الأقل أولاً"));
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
        throw new Error(t(err.error || "فشل التصدير"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents-export-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t("تم تصدير {n} مستند مع كشف Excel", { n: selected.length }));
      setSelected([]);
    } catch (e) {
      toast.error(e instanceof Error ? t(e.message) : t("تعذّر التصدير مع الكشف"));
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
      if (!res.ok) throw new Error(t((await res.json()).error || "فشل"));
      toast.success(t("نقل {n} مستند إلى السلة", { n: ids.length }));
      setSelected([]);
      setDeleteOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? t(e.message) : t("فشل الحذف المجمع"));
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
      if (!res.ok) throw new Error(t((await res.json()).error || "فشل"));
      toast.success(t("تحديث حالة {n} مستند", { n: ids.length }));
      setSelected([]);
      setStatusOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? t(e.message) : t("فشل تحديث الحالة"));
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
      if (!res.ok) throw new Error(t((await res.json()).error || "فشل"));
      toast.success(t("إضافة الوسم إلى {n} مستند", { n: ids.length }));
      setSelected([]);
      setTagOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? t(e.message) : t("فشل إضافة الوسم"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Bulk actions toolbar */}
      <div
        className={`z-20 mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 shadow-card backdrop-blur-xl transition-all duration-200 ${
          selected.length > 0
            ? "border-indigo-200 bg-indigo-50/90 animate-fadein dark:border-indigo-800 dark:bg-indigo-950/40"
            : "hidden"
        }`}
      >
        <span className="tnum inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <span className="icon-tile h-7 w-7 bg-indigo-500/10 text-indigo-500 [&_svg]:h-3.5 [&_svg]:w-3.5">
            <ListChecks className="h-3.5 w-3.5" />
          </span>
          {t("مستندات محددة: {n}", { n: selected.length })}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tag Popover (downward with collisionPadding) */}
          <Popover open={tagOpen} onOpenChange={setTagOpen}>
            <PopoverTrigger
              disabled={busy === "tag"}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-medium text-foreground shadow-soft ring-1 ring-border transition hover:bg-muted hover:shadow-card disabled:opacity-60 dark:bg-indigo-950/60"
            >
              {busy === "tag" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
              {t("وسم")}
            </PopoverTrigger>
            <PopoverContent align="start" collisionPadding={12} className="w-52">
              <div className="border-b border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                {t("اختر الوسم")}
              </div>
              <div className="max-h-48 overflow-y-auto p-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleBulkTag(tag.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground transition hover:bg-muted"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))}
                {tagsError ? (
                  <p className="px-2.5 py-3 text-xs text-rose-500">{t("تعذّر تحميل الوسوم")}</p>
                ) : tags.length === 0 ? (
                  <p className="px-2.5 py-3 text-xs text-muted-foreground">{t("لا توجد وسوم")}</p>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>

          {/* Status Popover */}
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger
              disabled={busy === "status"}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-medium text-foreground shadow-soft ring-1 ring-border transition hover:bg-muted hover:shadow-card disabled:opacity-60 dark:bg-indigo-950/60"
            >
              {busy === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {t("حالة")}
            </PopoverTrigger>
            <PopoverContent align="start" collisionPadding={12} className="w-48">
              <div className="border-b border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                {t("تغيير الحالة إلى")}
              </div>
              <div className="p-1.5">
                {(["active", "pending_review", "archived", "draft"] as const).map((s) => {
                  const m = STATUS_META[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleBulkStatus(s)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground transition hover:bg-muted"
                    >
                      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                      {t(m.label)}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Delete Popover */}
          <Popover open={deleteOpen} onOpenChange={setDeleteOpen}>
            <PopoverTrigger
              disabled={busy === "delete"}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-medium text-rose-600 shadow-sm ring-1 ring-border transition hover:bg-rose-50 disabled:opacity-60 dark:bg-indigo-950/60"
            >
              {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {t("حذف")}
            </PopoverTrigger>
            <PopoverContent align="start" collisionPadding={12} className="w-56 p-3">
              <p className="text-xs text-foreground">
                {t("نقل {n} مستند إلى سلة المحذوفات؟", { n: ids.length })}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="flex-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                >
                  {t("نقل للسلة")}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  className="flex-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-border"
                >
                  {t("إلغاء")}
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Download */}
          <button
            type="button"
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

          {/* Export: ZIP + Excel manifest */}
          <button
            type="button"
            onClick={handleExportSelected}
            disabled={busy === "export"}
            title={t("تنزيل ZIP فيه الملفات + كشف Excel (غلاف EDMS، روابط تفتح داخل الحزمة)")}
            aria-busy={busy === "export"}
            aria-label={t("تصدير ZIP مع كشف Excel")}
            className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-[0_0_18px_-4px_rgba(16,185,129,0.7)] ring-1 ring-emerald-300/40 transition hover:from-emerald-500 hover:to-teal-500 hover:shadow-[0_0_24px_-4px_rgba(16,185,129,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
          >
            {busy === "export" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 transition group-hover:scale-110" />
            )}
            {busy === "export" ? t("جارٍ تجهيز الكشف…") : t("ZIP + كشف")}
          </button>
        </div>
      </div>

      {/* Quick interactive filter chips, live search, and Table/Cards view toggle */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t("تصفية سريعة")}>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{t("الكل")}</span>
            <span className="tnum rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] dark:bg-white/10">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("active")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "active"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{t("سارية")}</span>
            <span className="tnum rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] dark:bg-white/10">
              {counts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("pending_review")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "pending_review"
                ? "bg-amber-600 text-white shadow-sm shadow-amber-600/25"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{t("قيد المراجعة")}</span>
            <span className="tnum rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] dark:bg-white/10">
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("archived")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "archived"
                ? "bg-sky-600 text-white shadow-sm shadow-sky-600/25"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span>{t("مؤرشفة")}</span>
            <span className="tnum rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] dark:bg-white/10">
              {counts.archived}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("draft")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "draft"
                ? "bg-slate-700 text-white shadow-sm shadow-slate-700/25 dark:bg-slate-600"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>{t("مسودة")}</span>
            <span className="tnum rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] dark:bg-white/10">
              {counts.draft}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("confidential")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "confidential"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/25"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Lock className="h-3 w-3" />
            <span>{t("سرية")}</span>
            <span className="tnum rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] dark:bg-white/10">
              {counts.confidential}
            </span>
          </button>
        </div>

        {/* Live instant search box + View Toggle (Table vs Grid Cards) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56 sm:w-64">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder={t("فلترة سريعة بالاسم أو الرقم...")}
              className="h-8.5 w-full rounded-xl border border-border bg-card ps-8 pe-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {clientSearch && (
              <button
                type="button"
                onClick={() => setClientSearch("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div
            className="inline-flex items-center rounded-xl border border-border bg-card p-0.5 shadow-sm"
            role="group"
            aria-label={t("طريقة العرض")}
          >
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title={t("عرض الجدول")}
              aria-label={t("عرض الجدول")}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Table2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("جدول")}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              title={t("عرض البطاقات الشبكية")}
              aria-label={t("عرض البطاقات الشبكية")}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                viewMode === "cards"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("بطاقات")}</span>
            </button>
          </div>

          <div className="tnum text-[11px] font-medium text-muted-foreground whitespace-nowrap">
            {t("عرض {shown} من {all}", { shown: filteredRows.length, all: rows.length })}
          </div>
        </div>
      </div>

      {/* Main Content Area: AG Grid Table OR Grid Cards View */}
      {viewMode === "table" ? (
        <div className="documents-grid-area relative min-h-[200px]">
          <DocumentsGrid
            rows={filteredRows}
            onSelectionChange={setSelected}
            onQuickPreview={setPreviewDoc}
          />
        </div>
      ) : (
        <div className="grid-auto-fit-md flex-1 overflow-y-auto pb-4">
          {filteredRows.map((doc) => {
            const st = STATUS_META[doc.status] ?? STATUS_META.active;
            const isSelected = selected.some((s) => s.id === doc.id);
            return (
              <div
                key={doc.id}
                className={cn(
                  "card-interactive flex flex-col justify-between rounded-2xl border bg-card p-4 shadow-soft",
                  isSelected
                    ? "border-primary ring-2 ring-primary/25"
                    : "border-border"
                )}
              >
                <div>
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCardSelection(doc)}
                        aria-label={doc.title}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      {doc.docNumber && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {doc.docNumber}
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {doc.confidential && (
                        <Lock className="h-4 w-4 rounded-md bg-rose-500/10 p-0.5 text-rose-600 dark:text-rose-400" />
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          st.badge
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                        {t(st.label)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/documents/${doc.id}`}
                    className="line-clamp-2 text-sm font-bold text-foreground transition hover:text-primary"
                  >
                    {doc.title}
                  </Link>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {doc.docType && (
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
                        style={docTypeStyle(doc.docTypeColor)}
                      >
                        {t(doc.docType)}
                      </span>
                    )}
                    {doc.departmentName && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: doc.departmentColor ?? "#94a3b8" }}
                        />
                        {doc.departmentName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                  <span className="tnum">
                    {formatBytes(doc.fileSize)} · {formatDate(doc.date)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {t("معاينة سريعة")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Preview Side Drawer */}
      {previewDoc && (
        <>
          <div
            className="fixed inset-0 z-40 animate-fadein bg-slate-950/40 backdrop-blur-xs"
            onClick={() => setPreviewDoc(null)}
          />
          <aside
            role="dialog"
            aria-label={t("معاينة سريعة للمستند")}
            className="surface-dialog fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s border-border bg-card shadow-2xl animate-fadein"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="icon-tile h-9 w-9 bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-foreground">{previewDoc.title}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {previewDoc.docNumber || t("بدون رقم مرجعي")} · {formatBytes(previewDoc.fileSize)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label={t("إغلاق")}
                className="rounded-xl p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
                  <Loader2 className="me-2 h-4 w-4 animate-spin text-primary" />
                  {t("جاري تحميل تفاصيل المستند...")}
                </div>
              ) : previewData ? (
                <>
                  {/* Metadata summary */}
                  <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs">
                    <div className="mb-2 font-bold text-foreground">{t("البيانات الوصفية")}</div>
                    <dl className="grid grid-cols-2 gap-2.5">
                      <div>
                        <dt className="text-muted-foreground">{t("القسم")}</dt>
                        <dd className="font-semibold text-foreground">{previewData.document.departmentName || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("المجلد")}</dt>
                        <dd className="font-semibold text-foreground">{previewData.document.folderName || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("النوع")}</dt>
                        <dd className="font-semibold text-foreground">{previewData.document.docType || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("الإصدار الحالي")}</dt>
                        <dd className="tnum font-semibold text-foreground">v{previewData.document.version}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("رفعه")}</dt>
                        <dd className="font-semibold text-foreground">{previewData.document.uploaderName || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("تاريخ المستند")}</dt>
                        <dd className="tnum font-semibold text-foreground">{previewData.document.docDate || formatDate(previewData.document.createdAt)}</dd>
                      </div>
                    </dl>
                    {previewData.document.description && (
                      <p className="mt-3 border-t border-border/60 pt-2.5 leading-relaxed text-muted-foreground">
                        {previewData.document.description}
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Tag className="h-3.5 w-3.5 text-primary" />
                      {t("الوسوم")}
                    </div>
                    {previewData.tags.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("لا توجد وسوم مرتبطة")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {previewData.tags.map((tg) => (
                          <span
                            key={tg.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground"
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tg.color }} />
                            {tg.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Version History */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <History className="h-3.5 w-3.5 text-primary" />
                      {t("سجل الإصدارات")} ({previewData.versions.length})
                    </div>
                    <div className="space-y-2">
                      {previewData.versions.map((ver) => (
                        <div
                          key={ver.id}
                          className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground">
                              v{ver.version} — {ver.note || ver.originalName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {ver.uploaderName || "—"} · {formatDate(ver.createdAt)}
                            </div>
                          </div>
                          <span className="tnum shrink-0 text-[11px] text-muted-foreground">
                            {formatBytes(ver.fileSize)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Approval Trail */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                      {t("مسار الاعتمادات")} ({previewData.approvals.length})
                    </div>
                    {previewData.approvals.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("لا توجد طلبات اعتماد مسجلة")}</p>
                    ) : (
                      <div className="space-y-2">
                        {previewData.approvals.map((ap) => (
                          <div
                            key={ap.id}
                            className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">{ap.approverName || "—"}</span>
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {t(ap.status)}
                              </span>
                            </div>
                            {(ap.responseNote || ap.comment) && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {ap.responseNote || ap.comment}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-2 border-t border-border p-4">
              <Link
                href={`/documents/${previewDoc.id}`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("فتح صفحة المستند الكاملة")}
              </Link>
              <a
                href={`/api/documents/${previewDoc.id}/file?download=1`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                {t("تنزيل")}
              </a>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

/**
 * CSV export button for the documents filter form. Forwards all active
 * filter and search parameters (`q`, `status`, `dept`, `docType`, `folder`)
 * to `/api/reports/export?type=documents&...`.
 */
export function CsvExportButton() {
  useLang(); // re-render on language toggle
  const [busy, setBusy] = useState(false);

  async function handleExportCsv(e: React.MouseEvent<HTMLButtonElement>) {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("type", "documents");

      // Collect current URL searchParams + any live form inputs in the filter form
      if (typeof window !== "undefined") {
        const currentSp = new URLSearchParams(window.location.search);
        for (const [k, v] of currentSp.entries()) {
          if (v && k !== "type") {
            params.set(k === "type" ? "docType" : k, v);
          }
        }
        const form = e.currentTarget.closest("form");
        if (form) {
          const fd = new FormData(form);
          const qVal = String(fd.get("q") || "").trim();
          const statusVal = String(fd.get("status") || "").trim();
          const deptVal = String(fd.get("dept") || "").trim();
          const typeVal = String(fd.get("type") || "").trim();
          const folderVal = String(fd.get("folder") || "").trim();
          if (qVal) params.set("q", qVal);
          if (statusVal) params.set("status", statusVal);
          if (deptVal) params.set("dept", deptVal);
          if (typeVal) params.set("docType", typeVal);
          if (folderVal) params.set("folder", folderVal);
        }
      }

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error(t("فشل التصدير ({code})", { code: res.status }));
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
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t("تم تصدير كشف CSV بنجاح"));
    } catch (err) {
      toast.error(err instanceof Error ? t(err.message) : t("تعذّر تصدير CSV"));
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
      {busy ? t("جارٍ التصدير…") : t("تصدير CSV")}
    </button>
  );
}
