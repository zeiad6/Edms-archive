"use client";
import { t as tr } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState, useMemo } from "react";
import { Trash2, RotateCcw, AlertTriangle, FileText, Download, Trash, Search, X } from "lucide-react";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { formatBytes, formatDate } from "@/lib/format";
import { emptyTrash, restoreDocument, forceDeleteDocument } from "@/actions/documents";

interface DeletedDoc {
  id: number;
  title: string;
  docNumber: string | null;
  docType: string | null;
  mimeType: string | null;
  fileSize: number;
  deletedAt: string | null;
  fileName: string | null;
  originalName: string | null;
}

export default function TrashClient({
  deletedDocs,
  totalCount,
  docTypes,
}: {
  deletedDocs: DeletedDoc[];
  totalCount: number;
  docTypes: string[];
}) {
  useLang(); // re-render on language toggle
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Total size is stable per list — compute once, not on every render.
  const totalSize = useMemo(() => deletedDocs.reduce((s, d) => s + d.fileSize, 0), [deletedDocs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deletedDocs.filter((doc) => {
      if (q) {
        const fields = [doc.title, doc.docNumber, doc.docType, doc.originalName];
        if (!fields.some((f) => f && f.toLowerCase().includes(q))) return false;
      }
      if (typeFilter && doc.docType !== typeFilter) return false;
      return true;
    });
  }, [deletedDocs, search, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="card-interactive p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="icon-tile bg-rose-100 text-rose-600 shadow-soft dark:bg-rose-500/10">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <div className="tnum text-2xl font-bold text-foreground">{totalCount}</div>
              <div className="text-xs text-muted-foreground">{tr("مستند في السلة")}</div>
            </div>
          </div>
        </Card>
        <Card className="card-interactive p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="icon-tile bg-amber-100 text-amber-600 shadow-soft dark:bg-amber-500/10">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="tnum text-2xl font-bold text-foreground">
                {formatBytes(totalSize)}
              </div>
              <div className="text-xs text-muted-foreground">{tr("الحجم الإجمالي")}</div>
            </div>
          </div>
        </Card>
        <Card className="card-interactive p-4 sm:p-5">
          <form action={emptyTrash}>
            <button
              type="submit"
              disabled={totalCount === 0}
              className="flex w-full items-center gap-3 rounded-xl disabled:opacity-40"
              onClick={(e) => {
                if (!confirm(tr("تفريغ سلة المحذوفات بالكامل؟ ({n} مستند) لا يمكن التراجع.", { n: totalCount }))) {
                  e.preventDefault();
                }
              }}
            >
              <div className="icon-tile bg-rose-600 text-white shadow-md shadow-rose-600/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="text-start">
                <div className="text-sm font-bold text-foreground">{tr("تفريغ السلة")}</div>
                <div className="text-xs text-muted-foreground">{tr("حذف {n} مستند نهائياً", { n: totalCount })}</div>
              </div>
            </button>
          </form>
        </Card>
      </div>

      {/* Search + filter bar */}
      <div className="filter-bar">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("بحث في العنوان أو الرقم...")}
            className="h-10 w-full rounded-xl border border-border bg-muted ps-10 pe-9 text-sm text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label={tr("مسح")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-lg p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-xl border border-border bg-muted px-3 text-sm text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
        >
          <option value="">{tr("كل الأنواع")}</option>
          {docTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(search || typeFilter) && (
          <button
            onClick={() => { setSearch(""); setTypeFilter(""); }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground shadow-soft transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />{tr("مسح")}</button>
        )}
        {(search || typeFilter) && (
          <span className="tnum text-xs text-muted-foreground">
            {tr("{a} من {b}", { a: filtered.length, b: totalCount })}
          </span>
        )}
      </div>

      {/* Documents list */}
      {deletedDocs.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            icon={Trash2}
            title={tr("السلة فارغة")}
            description={tr("المستندات المحذوفة ستظهر هنا. يمكنك استعادتها أو حذفها نهائياً.")}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            icon={Search}
            title={tr("لا توجد نتائج")}
            description={tr("حاول تغيير مصطلح البحث أو نوع المستند.")}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((doc) => (
            <Card key={doc.id} className="card-interactive flex items-center gap-4 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground shadow-soft ring-1 ring-inset ring-border/50">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{doc.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{doc.docType || tr("بدون تصنيف")}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tnum">{formatBytes(doc.fileSize)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{tr("حُذف {d}", { d: doc.deletedAt ? formatDate(doc.deletedAt) : "" })}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <form action={restoreDocument.bind(null, doc.id)}>
                  <button
                    type="submit"
                    title={tr("استعادة")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-soft transition hover:border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />{tr("استعادة")}</button>
                </form>
                <a
                  href={`/api/documents/${doc.id}/file?download=1`}
                  aria-label={tr("تنزيل")}
                  title={tr("تنزيل")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-soft transition hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <form action={forceDeleteDocument.bind(null, doc.id)}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-card px-3 py-2 text-xs font-medium text-rose-600 shadow-soft transition hover:bg-rose-50 hover:shadow-card dark:border-rose-500/30 dark:hover:bg-rose-500/10"
                    onClick={(e) => {
                      if (!confirm(tr("حذف “{name}” نهائياً؟ لا يمكن التراجع.", { name: doc.title }))) e.preventDefault();
                    }}
                  >
                    <Trash className="h-3.5 w-3.5" />{tr("حذف")}</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
