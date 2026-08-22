"use client";

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
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/10">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{totalCount}</div>
              <div className="text-xs text-muted-foreground">مستند في السلة</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/10">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {formatBytes(totalSize)}
              </div>
              <div className="text-xs text-muted-foreground">الحجم الإجمالي</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <form action={emptyTrash}>
            <button
              type="submit"
              disabled={totalCount === 0}
              className="flex w-full items-center gap-3 disabled:opacity-40"
              onClick={(e) => {
                if (!confirm(`تفريغ سلة المحذوفات بالكامل؟ (${totalCount} مستند) لا يمكن التراجع.`)) {
                  e.preventDefault();
                }
              }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="text-start">
                <div className="text-sm font-bold text-foreground">تفريغ السلة</div>
                <div className="text-xs text-muted-foreground">حذف {totalCount} مستند نهائياً</div>
              </div>
            </button>
          </form>
        </Card>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في العنوان أو الرقم..."
            className="w-full rounded-xl border border-border bg-muted py-2.5 ps-10 pe-3 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
        >
          <option value="">كل الأنواع</option>
          {docTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(search || typeFilter) && (
          <button
            onClick={() => { setSearch(""); setTypeFilter(""); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
          >
            <X className="h-4 w-4" /> مسح
          </button>
        )}
        {(search || typeFilter) && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} من {totalCount}
          </span>
        )}
      </div>

      {/* Documents list */}
      {deletedDocs.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            icon={Trash2}
            title="السلة فارغة"
            description="المستندات المحذوفة ستظهر هنا. يمكنك استعادتها أو حذفها نهائياً."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            icon={Search}
            title="لا توجد نتائج"
            description="حاول تغيير مصطلح البحث أو نوع المستند."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <Card key={doc.id} className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{doc.title}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{doc.docType || "بدون تصنيف"}</span>
                  <span>·</span>
                  <span>{formatBytes(doc.fileSize)}</span>
                  <span>·</span>
                  <span>مُحوَى {doc.deletedAt ? formatDate(doc.deletedAt) : ""}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <form action={restoreDocument.bind(null, doc.id)}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> استعادة
                  </button>
                </form>
                <a
                  href={`/api/documents/${doc.id}/file?download=1`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <form action={forceDeleteDocument.bind(null, doc.id)}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-card px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
                    onClick={(e) => {
                      if (!confirm(`حذف "${doc.title}" نهائياً؟ لا يمكن التراجع.`)) e.preventDefault();
                    }}
                  >
                    <Trash className="h-3.5 w-3.5" /> حذف
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
