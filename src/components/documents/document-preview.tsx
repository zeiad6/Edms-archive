"use client";

import { useState, useCallback } from "react";
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
import { cn, isImage, formatBytes } from "@/lib/format";

function ExtIcon({ ext }: { ext: string }) {
  if (["xls", "xlsx"].includes(ext)) return <FileSpreadsheet className="h-12 w-12 text-emerald-500" />;
  if (["doc", "docx"].includes(ext)) return <FileType2 className="h-12 w-12 text-sky-500" />;
  if (["pdf"].includes(ext)) return <FileText className="h-12 w-12 text-rose-500" />;
  return <File className="h-12 w-12 text-muted-foreground" />;
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imgCacheBust] = useState(() => Date.now());

  const fileUrl = `/api/documents/${id}/file`;
  const downloadUrl = `${fileUrl}?download=1`;

  const resetTransform = useCallback(() => {
    setZoom(1);
    setRotation(0);
  }, []);

  const openLightbox = useCallback(() => {
    setLightboxOpen(true);
    resetTransform();
  }, [resetTransform]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    resetTransform();
  }, [resetTransform]);

  /* ── Images ──────────────────────────────────── */
  if (isImage(mime)) {
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
          <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
            اضغط للتكبير
          </span>
        </button>

        {/* Lightbox modal */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label={`معاينة: ${title}`}
          >
            {/* Toolbar */}
            <div
              className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-xl bg-black/50 p-1.5 backdrop-blur"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label="تكبير"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label="تصغير"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label="تدوير"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <span className="mx-1 h-5 w-px bg-white/20" />
              <a
                href={downloadUrl}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label="تنزيل"
              >
                <Download className="h-4 w-4" />
              </a>
              <span className="mx-1 h-5 w-px bg-white/20" />
              <button
                type="button"
                onClick={closeLightbox}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Zoom level indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/70 backdrop-blur">
              {Math.round(zoom * 100)}%
            </div>

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic API document image, zoom/rotate via CSS transform */}
            <img
              src={`${fileUrl}?t=${imgCacheBust}`}
              alt={title}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] select-none transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        )}
      </>
    );
  }

  /* ── PDF ─────────────────────────────────────── */
  if (mime === "application/pdf") {
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <iframe
          src={`${fileUrl}#navpanes=0&view=FitH`}
          title={title}
          className="h-full w-full"
          aria-label={`معاينة PDF: ${title}`}
        />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80"
          >
            <Download className="h-3.5 w-3.5" />
            تنزيل
          </a>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80"
          >
            <FileText className="h-3.5 w-3.5" />
            فتح في نافذة جديدة
          </a>
        </div>
      </div>
    );
  }

  /* ── Fallback (Word, Excel, ZIP, etc.) ──────── */
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-muted/30">
      <ExtIcon ext={ext || ""} />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {ext ? `.${ext.toUpperCase()}` : "ملف"}
        </p>
        {fileSize !== null && (
          <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(fileSize)}</p>
        )}
      </div>
      <a
        href={downloadUrl}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        <Download className="h-4 w-4" />
        تنزيل الملف
      </a>
      {mime.startsWith("text/") && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-primary"
        >
          فتح في المتصفح
        </a>
      )}
    </div>
  );
}
