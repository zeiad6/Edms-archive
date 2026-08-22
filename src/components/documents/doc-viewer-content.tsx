"use client";

import { FileWarning, Loader2 } from "lucide-react";
import { isImage, isPdf } from "@/lib/format";

interface DocViewerContentProps {
  mime: string;
  url: string;
  download: string;
  title: string;
  pdfLoading: boolean;
  pdfError: string;
  zoom: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

function PdfErrorState({ error, download }: { error: string; download: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-slate-300">
      <FileWarning className="h-12 w-12" />
      <p className="text-sm">{error}</p>
      <a
        href={download}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
      >
        تنزيل الملف بدلاً من ذلك
      </a>
    </div>
  );
}

export function DocViewerContent({
  mime,
  url,
  download,
  title,
  pdfLoading,
  pdfError,
  zoom,
  canvasRef,
}: DocViewerContentProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
      {isPdf(mime) ? (
        pdfLoading ? (
          <div className="flex flex-col items-center gap-3 text-slate-300">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm">جارٍ تحميل المستند...</p>
          </div>
        ) : pdfError ? (
          <PdfErrorState error={pdfError} download={download} />
        ) : (
          <canvas
            ref={canvasRef}
            className="rounded-lg bg-white shadow-2xl transition-transform"
          />
        )
      ) : isImage(mime) ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic uploaded document: blob/API URL, unknown dimensions, zoom via CSS transform
        <img
          src={url}
          alt={title}
          style={{ transform: `scale(${zoom})` }}
          className="max-h-full max-w-full origin-top rounded-lg bg-white shadow-2xl transition-transform"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <FileWarning className="h-12 w-12" />
          <p className="text-sm">لا يمكن عرض هذا النوع من الملفات داخل المتصفح</p>
          <a
            href={download}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            تنزيل الملف
          </a>
        </div>
      )}
    </div>
  );
}
