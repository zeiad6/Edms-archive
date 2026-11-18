"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  PanelRight,
  Printer,
  RotateCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { isImage, isPdf } from "@/lib/format";

export interface DocViewerToolbarProps {
  title: string;
  mime: string;
  pdfLoading: boolean;
  numPages: number;
  pageNum: number;
  zoom: number;
  download: string;
  showThumbnails?: boolean;
  searchQuery?: string;
  searchMatchCount?: number;
  searchMatchIndex?: number;
  onPageChange: (n: number) => void;
  onZoomChange: (z: number) => void;
  onFitWidth?: () => void;
  onRotate: () => void;
  onToggleThumbnails?: () => void;
  onSearchChange?: (q: string) => void;
  onNextSearchMatch?: () => void;
  onPrint?: () => void;
  onClose: () => void;
}

function ZoomControl({
  zoom,
  onZoomChange,
  onFitWidth,
}: {
  zoom: number;
  onZoomChange: (z: number) => void;
  onFitWidth?: () => void;
}) {
  return (
    <div className="ms-1 flex items-center gap-1 rounded-lg bg-white/10 p-1">
      <button
        type="button"
        onClick={() => onZoomChange(Math.max(0.4, Number((zoom - 0.2).toFixed(2))))}
        title={t("تصغير")}
        aria-label={t("تصغير")}
        className="rounded p-1 text-slate-200 hover:bg-white/10"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <span className="w-11 text-center text-[11px] tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={() => onZoomChange(Math.min(3, Number((zoom + 0.2).toFixed(2))))}
        title={t("تكبير")}
        aria-label={t("تكبير")}
        className="rounded p-1 text-slate-200 hover:bg-white/10"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      {onFitWidth && (
        <button
          type="button"
          onClick={onFitWidth}
          title={t("ملاءمة عرض الصفحة")}
          aria-label={t("ملاءمة عرض الصفحة")}
          className="rounded p-1 text-slate-200 hover:bg-white/10"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function PageNav({
  pageNum,
  numPages,
  onPageChange,
}: {
  pageNum: number;
  numPages: number;
  onPageChange: (n: number) => void;
}) {
  function handlePageInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) onPageChange(v);
  }

  return (
    <div className="me-1 flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1">
      <button
        type="button"
        onClick={() => onPageChange(pageNum - 1)}
        disabled={pageNum <= 1}
        aria-label={t("الصفحة السابقة")}
        className="rounded p-1 text-slate-200 hover:bg-white/20 disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <input
        type="number"
        min={1}
        max={numPages}
        value={pageNum}
        onChange={handlePageInput}
        className="w-10 bg-transparent text-center text-[11px] tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-[11px] text-slate-400">/ {numPages}</span>
      <button
        type="button"
        onClick={() => onPageChange(pageNum + 1)}
        disabled={pageNum >= numPages}
        aria-label={t("الصفحة التالية")}
        className="rounded p-1 text-slate-200 hover:bg-white/20 disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DocViewerToolbar({
  title,
  mime,
  pdfLoading,
  numPages,
  pageNum,
  zoom,
  download,
  showThumbnails = false,
  searchQuery = "",
  searchMatchCount = 0,
  searchMatchIndex = 0,
  onPageChange,
  onZoomChange,
  onFitWidth,
  onRotate,
  onToggleThumbnails,
  onSearchChange,
  onNextSearchMatch,
  onPrint,
  onClose,
}: DocViewerToolbarProps) {
  useLang(); // re-render on language toggle
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {isPdf(mime) && numPages > 0 && onToggleThumbnails && (
          <button
            type="button"
            onClick={onToggleThumbnails}
            title={t("مصغرات الصفحات")}
            aria-label={t("مصغرات الصفحات")}
            className={`rounded-lg p-2 transition ${
              showThumbnails ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-200 hover:bg-white/20"
            }`}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-slate-400">
            {isPdf(mime)
              ? pdfLoading
                ? t("جارٍ تحميل PDF...")
                : numPages > 0
                  ? t("عرض المستند — {a} من {b} صفحات", { a: pageNum, b: numPages })
                  : t("عرض المستند")
              : t("عرض آمن عبر البث المباشر — لا يُحفظ على القرص المحلي")}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {isPdf(mime) && numPages > 0 && (
          <>
            {onSearchChange && (
              <div className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1">
                <Search className="h-3.5 w-3.5 text-slate-300" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && onNextSearchMatch) {
                      e.preventDefault();
                      onNextSearchMatch();
                    }
                  }}
                  placeholder={t("بحث داخل المستند...")}
                  aria-label={t("بحث داخل المستند")}
                  className="w-32 bg-transparent text-xs text-white placeholder:text-slate-400 outline-none sm:w-40"
                />
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={onNextSearchMatch}
                    className="tnum rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-white/20"
                    title={t("النتيجة التالية")}
                  >
                    {searchMatchCount > 0 ? `${searchMatchIndex + 1}/${searchMatchCount}` : "0"}
                  </button>
                )}
              </div>
            )}
            <PageNav pageNum={pageNum} numPages={numPages} onPageChange={onPageChange} />
            <ZoomControl zoom={zoom} onZoomChange={onZoomChange} onFitWidth={onFitWidth} />
            <button
              type="button"
              onClick={onRotate}
              title={t("تدوير الصفحة")}
              aria-label={t("تدوير الصفحة")}
              className="rounded-lg bg-white/10 p-2 text-slate-200 transition hover:bg-white/20"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </>
        )}

        {isImage(mime) && (
          <>
            <ZoomControl zoom={zoom} onZoomChange={onZoomChange} onFitWidth={onFitWidth} />
            <button
              type="button"
              onClick={onRotate}
              title={t("تدوير")}
              aria-label={t("تدوير")}
              className="rounded-lg bg-white/10 p-2 text-slate-200 transition hover:bg-white/20"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onPrint ?? (() => window.print())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20"
        >
          <Printer className="h-4 w-4" />
          {t("طباعة")}
        </button>
        <a
          href={download}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20"
        >
          <Download className="h-4 w-4" />
          {t("تنزيل")}
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("إغلاق")}
          className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-rose-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
