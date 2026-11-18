"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye } from "lucide-react";
import type * as pdfjsLib from "pdfjs-dist";

import { isPdf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DocumentDeleteDialog } from "@/components/documents/document-delete-dialog";
import { DocViewerContent } from "@/components/documents/doc-viewer-content";
import { DocViewerToolbar } from "@/components/documents/doc-viewer-toolbar";

function PdfThumbnailItem({
  pdfDoc,
  pageNumber,
  active,
  matched,
  onSelect,
}: {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  active: boolean;
  matched: boolean;
  onSelect: (n: number) => void;
}) {
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: pdfjsLib.RenderTask | null = null;

    pdfDoc
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled || !thumbCanvasRef.current) return;
        const canvas = thumbCanvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const vp = page.getViewport({ scale: 0.22 });
        canvas.width = Math.max(1, Math.floor(vp.width));
        canvas.height = Math.max(1, Math.floor(vp.height));
        task = page.render({ canvasContext: ctx, viewport: vp });
        task.promise.catch((err: { name?: string }) => {
          if (err?.name !== "RenderingCancelledException") {
            /* ignore thumbnail render error */
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [pdfDoc, pageNumber]);

  return (
    <button
      type="button"
      onClick={() => onSelect(pageNumber)}
      className={`group flex w-full flex-col items-center gap-1.5 rounded-xl p-2 text-xs transition ${
        active
          ? "bg-indigo-600/30 text-white ring-2 ring-indigo-400"
          : matched
            ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/60 hover:bg-amber-500/30"
            : "bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      <canvas
        ref={thumbCanvasRef}
        className="max-w-full rounded bg-white shadow-sm"
      />
      <span className="tnum text-[11px] font-medium">
        {t("صفحة")} {pageNumber}
      </span>
    </button>
  );
}

export function DocViewer({
  id,
  mime,
  ext,
  title,
  onClose,
}: {
  id: number;
  mime: string;
  ext?: string | null;
  title: string;
  onClose: () => void;
}) {
  useLang(); // re-render on language toggle
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchingPages, setMatchingPages] = useState<number[]>([]);
  const [matchIdx, setMatchIdx] = useState(0);

  const url = `/api/documents/${id}/file`;
  const download = `/api/documents/${id}/file?download=1`;

  // PDF state
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pageTextsRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (!isPdf(mime)) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError("");
    setPdfDoc(null);
    setNumPages(0);
    pageTextsRef.current.clear();

    import("pdfjs-dist")
      .then(async (pdfjs) => {
        if (cancelled) return null;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "./documents/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        // Stream binary PDF bytes directly from /api/documents/[id]/file
        // (supports Accept-Ranges & Content-Range without Base64 overhead).
        const res = await fetch(url, { credentials: "same-origin" });
        if (cancelled) return null;
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const buf = await res.arrayBuffer();
        if (cancelled) return null;
        return pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      })
      .then((doc) => {
        if (cancelled || !doc) return;
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        setRotation(0);
        setPdfLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPdfDoc(null);
        setNumPages(0);
        setPdfError(t("تعذّر تحميل ملف PDF"));
        setPdfLoading(false);
      });

    return () => {
      cancelled = true;
      try {
        renderTaskRef.current?.cancel();
      } catch {
        /* ignore */
      }
      renderTaskRef.current = null;
      pdfDocRef.current?.destroy().catch(() => {});
      pdfDocRef.current = null;
      setPdfDoc(null);
      setNumPages(0);
    };
  }, [id, mime, url]);

  const renderPage = useCallback(() => {
    if (!pdfDoc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    try {
      renderTaskRef.current?.cancel();
    } catch {
      /* ignore */
    }
    renderTaskRef.current = null;

    pdfDoc
      .getPage(pageNum)
      .then((page) => {
        if (cancelled) return;
        const vp = page.getViewport({ scale: zoom, rotation });
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(vp.width * outputScale);
        canvas.height = Math.floor(vp.height * outputScale);
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;

        ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        const renderCtx = {
          canvasContext: ctx,
          viewport: vp,
        };
        const task = page.render(renderCtx);
        renderTaskRef.current = task;
        task.promise.catch((err: { name?: string }) => {
          if (err?.name === "RenderingCancelledException") {
            return;
          }
          if (!cancelled) {
            console.error("[pdf-viewer] page render error:", err);
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try {
        renderTaskRef.current?.cancel();
      } catch {
        /* ignore */
      }
      renderTaskRef.current = null;
    };
  }, [pdfDoc, pageNum, zoom, rotation]);

  useEffect(() => {
    const cleanup = renderPage();
    return cleanup;
  }, [renderPage]);

  // Search inside PDF pages
  useEffect(() => {
    if (!pdfDoc) {
      setMatchingPages([]);
      setMatchIdx(0);
      return;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setMatchingPages([]);
      setMatchIdx(0);
      return;
    }

    let cancelled = false;
    (async () => {
      const hits: number[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (cancelled) return;
        let text = pageTextsRef.current.get(i);
        if (text === undefined) {
          try {
            const p = await pdfDoc.getPage(i);
            const tc = await p.getTextContent();
            text = tc.items
              .map((it) => ("str" in it ? it.str : ""))
              .join(" ")
              .toLowerCase();
            pageTextsRef.current.set(i, text);
          } catch {
            text = "";
          }
        }
        if (text.includes(q)) {
          hits.push(i);
        }
      }
      if (!cancelled) {
        setMatchingPages(hits);
        setMatchIdx(0);
        if (hits.length > 0) {
          setPageNum(hits[0]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, searchQuery]);

  function gotoPage(n: number) {
    const p = Math.max(1, Math.min(numPages, n));
    setPageNum(p);
  }

  function rotate() {
    setRotation((r) => (r + 90) % 360);
  }

  async function fitToWidth() {
    if (!pdfDoc || !containerRef.current) {
      setZoom(1.2);
      return;
    }
    try {
      const page = await pdfDoc.getPage(pageNum);
      const baseVp = page.getViewport({ scale: 1, rotation });
      const availableWidth = Math.max(320, containerRef.current.clientWidth - 64);
      const nextScale = Math.max(0.5, Math.min(2.5, Number((availableWidth / baseVp.width).toFixed(2))));
      setZoom(nextScale);
    } catch {
      setZoom(1.2);
    }
  }

  function handleNextMatch() {
    if (matchingPages.length === 0) return;
    const next = (matchIdx + 1) % matchingPages.length;
    setMatchIdx(next);
    setPageNum(matchingPages[next]);
  }

  function handlePrint() {
    if (isPdf(mime)) {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.print();
        }
        setTimeout(() => iframe.remove(), 60_000);
      };
      return;
    }
    window.print();
  }

  return (
    <div className="animate-fadein fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md">
      <DocViewerToolbar
        title={title}
        mime={mime}
        pdfLoading={pdfLoading}
        numPages={numPages}
        pageNum={pageNum}
        zoom={zoom}
        download={download}
        showThumbnails={showThumbnails}
        searchQuery={searchQuery}
        searchMatchCount={matchingPages.length}
        searchMatchIndex={matchIdx}
        onPageChange={gotoPage}
        onZoomChange={setZoom}
        onFitWidth={fitToWidth}
        onRotate={rotate}
        onToggleThumbnails={() => setShowThumbnails((v) => !v)}
        onSearchChange={setSearchQuery}
        onNextSearchMatch={handleNextMatch}
        onPrint={handlePrint}
        onClose={onClose}
      />

      <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
        {isPdf(mime) && pdfDoc && showThumbnails && numPages > 0 && (
          <aside
            aria-label={t("مصغرات الصفحات")}
            className="w-40 shrink-0 space-y-2.5 overflow-y-auto border-e border-white/10 bg-slate-900/70 p-3"
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <PdfThumbnailItem
                key={n}
                pdfDoc={pdfDoc}
                pageNumber={n}
                active={n === pageNum}
                matched={matchingPages.includes(n)}
                onSelect={gotoPage}
              />
            ))}
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <DocViewerContent
            mime={mime}
            ext={ext}
            url={url}
            download={download}
            title={title}
            pdfLoading={pdfLoading}
            pdfError={pdfError}
            zoom={zoom}
            canvasRef={canvasRef}
          />
        </div>
      </div>
    </div>
  );
}

export function DocDetailClient({
  id,
  mime,
  ext,
  title,
  isAdmin,
}: {
  id: number;
  mime: string;
  ext?: string | null;
  title: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <DocViewer id={id} mime={mime} ext={ext} title={title} onClose={() => setOpen(false)} />}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button onClick={() => setOpen(true)}>
          <Eye className="h-4 w-4" />{t("عرض المستند")}</Button>
        <Button asChild variant="outline">
          <a href={`/api/documents/${id}/file?download=1`}>
            <Download className="h-4 w-4" />{t("تنزيل")}</a>
        </Button>
        {isAdmin && <DocumentDeleteDialog id={id} title={title} />}
      </div>
    </>
  );
}
