"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { isImage, isPdf } from "@/lib/format";

interface DocViewerToolbarProps {
  title: string;
  mime: string;
  pdfLoading: boolean;
  numPages: number;
  pageNum: number;
  zoom: number;
  download: string;
  onPageChange: (n: number) => void;
  onZoomChange: (z: number) => void;
  onRotate: () => void;
  onClose: () => void;
}

function ZoomControl({ zoom, onZoomChange }: { zoom: number; onZoomChange: (z: number) => void }) {
  return (
    <div className="ms-1 flex items-center gap-1 rounded-lg bg-white/10 p-1">
      <button
        onClick={() => onZoomChange(Math.max(0.4, zoom - 0.2))}
        className="rounded p-1 text-slate-200 hover:bg-white/10"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <span className="w-10 text-center text-[11px] tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => onZoomChange(Math.min(3, zoom + 0.2))}
        className="rounded p-1 text-slate-200 hover:bg-white/10"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
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
        onClick={() => onPageChange(pageNum - 1)}
        disabled={pageNum <= 1}
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
        onClick={() => onPageChange(pageNum + 1)}
        disabled={pageNum >= numPages}
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
  onPageChange,
  onZoomChange,
  onRotate,
  onClose,
}: DocViewerToolbarProps) {
  useLang(); // re-render on language toggle
  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
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
      <div className="flex items-center gap-1.5">
        {isPdf(mime) && numPages > 0 && (
          <>
            <PageNav pageNum={pageNum} numPages={numPages} onPageChange={onPageChange} />
            <ZoomControl zoom={zoom} onZoomChange={onZoomChange} />
            <button
              onClick={onRotate}
              className="rounded-lg bg-white/10 p-2 text-slate-200 transition hover:bg-white/20"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </>
        )}

        {isImage(mime) && <ZoomControl zoom={zoom} onZoomChange={onZoomChange} />}

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20"
        >
          <Printer className="h-4 w-4" />{t("طباعة")}</button>
        <a
          href={download}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20"
        >
          <Download className="h-4 w-4" />{t("تنزيل")}</a>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-rose-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
