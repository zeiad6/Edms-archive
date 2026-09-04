"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye } from "lucide-react";
import type * as pdfjsLib from "pdfjs-dist";

import { isPdf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DocumentDeleteDialog } from "@/components/documents/document-delete-dialog";
import { DocViewerContent } from "@/components/documents/doc-viewer-content";
import { DocViewerToolbar } from "@/components/documents/doc-viewer-toolbar";

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
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const url = `/api/documents/${id}/file`;
  const download = `/api/documents/${id}/file?download=1`;

  // PDF state
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Tracks the live PDF document so the effect cleanup can destroy it on unmount/swap.
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  // Tracks the in-flight page render so it can be cancelled on page/zoom change or unmount.
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  useEffect(() => {
    if (!isPdf(mime)) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError("");

    // pdfjs-dist (~1.4MB) is loaded on demand into its own chunk so it never
    // weighs down the initial bundle of pages that render the viewer.
    import("pdfjs-dist")
      .then(async (pdfjs) => {
        if (cancelled) return null;
        // Bundle the PDF worker locally (offline-first) instead of a CDN.
        // A RELATIVE `new URL(..., import.meta.url)` asset reference makes
        // Turbopack emit the vendored worker into the static output (which
        // the standalone/Electron build ships) — a bare-specifier URL cannot
        // be traced in the packaged build and produced a blank viewer.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "./documents/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        // Bytes via the pdf-data JSON route: raw `application/pdf` responses
        // are intercepted and emptied by download managers (IDM…), while JSON
        // passes through untouched.
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
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        setRotation(0);
        setPdfLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPdfError("تعذّر تحميل ملف PDF");
        setPdfLoading(false);
      });

    return () => {
      cancelled = true;
      // Release the PDF document (worker + memory) when the viewer unmounts
      // or switches to a different document.
      pdfDocRef.current?.destroy().catch(() => {});
      pdfDocRef.current = null;
    };
  }, [id, mime, url]);

  const renderPage = useCallback(() => {
    if (!pdfDoc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    pdfDoc.getPage(pageNum).then((page) => {
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
      renderTaskRef.current = page.render(renderCtx);
    });

    // Cancel any in-flight render when the page/zoom/rotation changes or on unmount.
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [pdfDoc, pageNum, zoom, rotation]);

  useEffect(() => {
    const cleanup = renderPage();
    return cleanup;
  }, [renderPage]);

  function gotoPage(n: number) {
    const p = Math.max(1, Math.min(numPages, n));
    setPageNum(p);
  }

  function rotate() {
    setRotation((r) => (r + 90) % 360);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <DocViewerToolbar
        title={title}
        mime={mime}
        pdfLoading={pdfLoading}
        numPages={numPages}
        pageNum={pageNum}
        zoom={zoom}
        download={download}
        onPageChange={gotoPage}
        onZoomChange={setZoom}
        onRotate={rotate}
        onClose={onClose}
      />
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
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)}>
          <Eye className="h-4 w-4" /> عرض المستند
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/documents/${id}/file?download=1`}>
            <Download className="h-4 w-4" /> تنزيل
          </a>
        </Button>
        {isAdmin && <DocumentDeleteDialog id={id} title={title} />}
      </div>
    </>
  );
}
