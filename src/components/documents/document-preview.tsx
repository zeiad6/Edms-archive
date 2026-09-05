"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState, useCallback, useEffect } from "react";
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  FileSpreadsheet,
  FileType2,
  File,
} from "lucide-react";
import {
  isBrowserImage,
  isTextPreviewable,
  isOfficeOnly,
  formatBytes,
} from "@/lib/format";
import { PdfPreview } from "./pdf-preview";

function ExtIcon({ ext }: { ext: string }) {
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="h-12 w-12 text-emerald-500" />;
  if (["doc", "docx", "rtf"].includes(ext)) return <FileType2 className="h-12 w-12 text-sky-500" />;
  if (["pdf"].includes(ext)) return <FileText className="h-12 w-12 text-rose-500" />;
  return <File className="h-12 w-12 text-muted-foreground" />;
}

/** Inline text preview (TXT/CSV): fetches the file as text, truncates safely. */
function TextPreview({ url, title }: { url: string; title: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 200KB cap — enough for a card preview without freezing on huge CSVs.
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setText(t.slice(0, 200_000));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed || text === "") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <FileText className="h-10 w-10 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{t("تعذّر تحميل المعاينة النصية — نزّل الملف لعرضه")}</p>
      </div>
    );
  }
  if (text === null) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <p className="animate-pulse text-xs text-muted-foreground">{t("جارٍ تحميل المعاينة...")}</p>
      </div>
    );
  }
  return (
    <pre
      dir="auto"
      aria-label={t("معاينة نصية: {x}", { x: title })}
      className="h-full w-full overflow-auto whitespace-pre-wrap break-words bg-muted/30 p-4 text-right text-xs leading-6 text-foreground"
    >
      {text}
    </pre>
  );
}

export function DocumentPreview({
  id,
  mime,
  ext,
  title,
  fileSize,
}: {
  id: number;
  mime: string;
  ext: string | null;
  title: string;
  fileSize: number | null;
}) {
  useLang(); // re-render on language toggle
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgCacheBust] = useState(() => Date.now());

  const fileUrl = `/api/documents/${id}/file`;
  const downloadUrl = `${fileUrl}?download=1`;

  const resetTransform = useCallback(() => {
    setZoom(1);
    setRotation(0);
  }, []);

  const openLightbox = useCallback(() => {
    setLightboxOpen(true);
    setImgLoaded(false);
    resetTransform();
  }, [resetTransform]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    resetTransform();
  }, [resetTransform]);

  // Esc closes the lightbox; +/- zoom via keyboard. No new deps.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 3));
      if (e.key === "-" || e.key === "_") setZoom((z) => Math.max(z - 0.25, 0.25));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, closeLightbox]);

  const normalizedExt = (ext || "").toLowerCase();
  /* ── Images (incl. SVG seed docs + BMP; TIFF excluded — no browser support) ── */
  if (isBrowserImage(mime, normalizedExt)) {
    return (
      <>
        <button
          type="button"
          onClick={openLightbox}
          className="group relative flex h-full w-full cursor-zoom-in items-center justify-center overflow-hidden bg-black/5 dark:bg-black/20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic API document image with cache-busting query, lazy-loaded */}
          <img
            src={`${fileUrl}?t=1`}
            alt={title}
            loading="lazy"
            className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
          />
          <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">{t("اضغط للتكبير")}</span>
        </button>

        {/* Lightbox modal */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label={t("معاينة: {x}", { x: title })}
          >
            {/* Toolbar */}
            <div
              className="absolute end-4 top-4 z-10 flex items-center gap-1 rounded-xl bg-black/55 p-1.5 shadow-lg backdrop-blur ring-1 ring-white/15"
              onClick={(e) => e.stopPropagation()}
              >
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={t("تكبير")}
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={t("تصغير")}
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={t("تدوير")}
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <span className="mx-1 h-5 w-px bg-white/20" />
              <a
                href={downloadUrl}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={t("تنزيل")}
              >
                <Download className="h-4 w-4" />
              </a>
              <span className="mx-1 h-5 w-px bg-white/20" />
              <button
                type="button"
                onClick={closeLightbox}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={t("إغلاق")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Zoom level indicator */}
            <div className="tnum absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white/85 shadow-lg backdrop-blur ring-1 ring-white/15">
              {Math.round(zoom * 100)}%{rotation !== 0 ? ` · ${rotation}°` : ""}
            </div>

            {!imgLoaded && (
              <div className="skeleton-shimmer h-64 w-64 rounded-2xl" role="status" aria-label={t("جارٍ تحميل الصورة")} />
            )}
            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic API document image, zoom/rotate via CSS transform */}
            <img
              src={`${fileUrl}?t=${imgCacheBust}`}
              alt={title}
              onClick={(e) => e.stopPropagation()}
              onLoad={() => setImgLoaded(true)}
              className="max-h-[90vh] max-w-[90vw] select-none rounded-lg shadow-2xl transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                display: imgLoaded ? undefined : "none",
              }}
            />
          </div>
        )}
      </>
    );
  }

  /* ── Plain text (TXT/CSV) ──────────────────────── */
  if (isTextPreviewable(mime, normalizedExt)) {
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <TextPreview url={fileUrl} title={title} />
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80"
          >
            <Download className="h-3.5 w-3.5" />{t("تنزيل")}</a>
        </div>
      </div>
    );
  }

  /* ── PDF (rendered with the vendored pdf.js build — no browser plugin
   * needed, works in Electron; pager included, graceful download fallback) */
  if (mime === "application/pdf") {
    return <PdfPreview id={id} url={fileUrl} title={title} downloadUrl={downloadUrl} />;
  }

  /* ── Fallback (Office, TIFF, RTF, etc.) ────────
   * No native browser renderer: explain why and offer download. Office files
   * need Word/Excel locally — the API requires auth so external online
   * viewers cannot open the URL. */
  const officeOnly = isOfficeOnly(normalizedExt);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-muted/30 p-6 text-center">
      <ExtIcon ext={normalizedExt} />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {ext ? `.${ext.toUpperCase()}` : t("ملف")}
        </p>
        {fileSize !== null && fileSize !== undefined && (
          <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(fileSize)}</p>
        )}
        <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
          {officeOnly
            ? t("لا يدعم المتصفح عرض ملفات Word و Excel مباشرة — نزّل الملف لفتحه في التطبيق المناسب")
            : t("لا يمكن معاينة هذا النوع داخل المتصفح — نزّل الملف لعرضه")}
        </p>
      </div>
      <a
        href={downloadUrl}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        <Download className="h-4 w-4" />{t("تنزيل الملف")}</a>
    </div>
  );
}
