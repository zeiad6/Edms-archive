"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";
import type * as pdfjsLib from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FileWarning,
  Loader2,
} from "lucide-react";

/**
 * PDF preview rendered with the vendored pdf.js build (no browser PDF plugin
 * required — works in Electron and every browser, with the session cookie).
 *
 * Renders the current page fitted to the container width with a pager for
 * multi-page documents. Any failure (corrupt file, missing worker, …) falls
 * back to download / open-in-new-window actions instead of a blank frame.
 */
export function PdfPreview({
  id,
  url,
  title,
  downloadUrl,
}: {
  id: number;
  /** Direct file URL — used only for the open-in-new-window link. */
  url: string;
  title: string;
  downloadUrl: string;
}) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  useLang(); // re-render (and re-translate labels) when the language toggles

  // Track the container width so the page always fits (card + responsive).
  // NOTE: a callback ref (not a mount-only effect) — the container mounts
  // only AFTER loading finishes, so observing must attach when the node
  // appears, not when the component first mounts.
  const observeContainer = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    containerRef.current = el;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContentWidth(w);
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);

  useEffect(() => () => roRef.current?.disconnect(), []);

  // Load the document (pdf.js is code-split — never in the initial bundle).
  // Bytes arrive base64-encoded inside JSON (see the pdf-data route): raw
  // `application/pdf` responses are intercepted and emptied by download
  // managers (IDM…), while JSON is never touched — so the viewer works on
  // machines where a direct fetch would return an empty body.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPdf(null);
    setPageNum(1);

    import("pdfjs-dist")
      .then(async (pdfjs) => {
        if (cancelled) return null;
        // Vendored worker (offline-first): a RELATIVE asset reference lets
        // Turbopack emit it into the static output (standalone/Electron).
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "./pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const res = await fetch(`/api/documents/${id}/pdf-data`);
        const body = await res.json().catch(() => null);
        if (cancelled) return null;
        if (!res.ok || !body?.data) {
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const bin = atob(body.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return pdfjs.getDocument({ data: bytes }).promise;
      })
      .then((doc) => {
        if (cancelled || !doc) return;
        pdfRef.current = doc;
        setPdf(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t("تعذّر عرض ملف PDF داخل المتصفح"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      pdfRef.current?.destroy().catch(() => {});
      pdfRef.current = null;
    };
  }, [id]);

  // Render the current page fitted to the container width.
  useEffect(() => {
    if (!pdf || !canvasRef.current || contentWidth <= 0) return;
    let cancelled = false;
    setRendering(true);
    renderTaskRef.current?.cancel();

    pdf
      .getPage(pageNum)
      .then((page) => {
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = contentWidth / base.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        return task.promise.then(() => {
          if (!cancelled) setRendering(false);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setRendering(false);
          setError(t("تعذّر عرض هذه الصفحة"));
        }
      });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [pdf, pageNum, contentWidth]);

  const gotoPage = useCallback(
    (n: number) => {
      setPageNum(Math.max(1, Math.min(numPages, n)));
    },
    [numPages],
  );

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/30 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">{t("جارٍ تحميل مستند PDF...")}</p>
      </div>
    );
  }

  if (error || !pdf) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center">
        <FileWarning className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{error || t("تعذّر عرض الملف")}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" />
            {t("تنزيل الملف")}
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <FileText className="h-3.5 w-3.5" />
            {t("فتح في نافذة جديدة")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div ref={observeContainer} className="relative flex h-full w-full flex-col overflow-hidden bg-muted/30">
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3">
        <canvas
          ref={canvasRef}
          aria-label={t("صفحة") + ` ${pageNum} / ${numPages}`}
          className="shrink-0 rounded-md bg-white shadow-lg"
        />
      </div>
      {rendering && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] text-white backdrop-blur">
            {t("جارٍ رسم الصفحة...")}
          </span>
        </div>
      )}
      {/* Pager + actions */}
      <div className="flex items-center justify-between gap-2 border-t border-border bg-card/90 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => gotoPage(pageNum - 1)}
            disabled={pageNum <= 1}
            aria-label={t("الصفحة السابقة")}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="tnum min-w-14 text-center text-xs font-semibold text-foreground">
            {pageNum} / {numPages}
          </span>
          <button
            type="button"
            onClick={() => gotoPage(pageNum + 1)}
            disabled={pageNum >= numPages}
            aria-label={t("الصفحة التالية")}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("فتح في نافذة جديدة")}
            title={t("فتح في نافذة جديدة")}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
          </a>
          <a
            href={downloadUrl}
            aria-label={t("تنزيل")}
            title={t("تنزيل")}
            className="rounded-lg bg-primary p-1.5 text-primary-foreground transition hover:opacity-90"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
