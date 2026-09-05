"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useEffect, useState } from "react";
import { FileWarning, Loader2 } from "lucide-react";
import { isBrowserImage, isPdf, isTextPreviewable, isOfficeOnly } from "@/lib/format";

interface DocViewerContentProps {
  mime: string;
  ext?: string | null;
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
    <div className="flex flex-col items-center gap-4 p-6 text-center text-slate-300">
      <FileWarning className="h-12 w-12" />
      <p className="text-sm">{error}</p>
      <a
        href={download}
        className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-white/20 active:scale-[0.98]"
      >{t("تنزيل الملف بدلاً من ذلك")}</a>
    </div>
  );
}

function ViewerTextPreview({ url, title }: { url: string; title: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setText(t.slice(0, 500_000));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) {
    return <p className="text-sm text-slate-300">{t("تعذّر تحميل المعاينة النصية — نزّل الملف لعرضه")}</p>;
  }
  if (text === null) {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-sm">{t("جارٍ تحميل المعاينة...")}</p>
      </div>
    );
  }
  return (
    <pre
      dir="auto"
      aria-label={t("معاينة نصية: {x}", { x: title })}
      className="max-h-full w-full max-w-4xl overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-white p-6 text-right text-sm leading-8 text-slate-900 shadow-pop ring-1 ring-white/20 sm:p-8"
    >
      {text}
    </pre>
  );
}

export function DocViewerContent({
  mime,
  ext,
  url,
  download,
  title,
  pdfLoading,
  pdfError,
  zoom,
  canvasRef,
}: DocViewerContentProps) {
  useLang(); // re-render on language toggle
  const normalizedExt = (ext || "").toLowerCase();
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-6">
      {isPdf(mime) ? (
        pdfLoading ? (
          <div className="flex flex-col items-center gap-3 text-slate-300">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm">{t("جارٍ تحميل المستند...")}</p>
          </div>
        ) : pdfError ? (
          <PdfErrorState error={pdfError} download={download} />
        ) : (
          <canvas
            ref={canvasRef}
            className="rounded-xl bg-white shadow-pop ring-1 ring-white/20 transition-transform"
          />
        )
      ) : isBrowserImage(mime, normalizedExt) ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic uploaded document: blob/API URL, unknown dimensions, zoom via CSS transform
        <img
          src={url}
          alt={title}
          style={{ transform: `scale(${zoom})` }}
          className="max-h-full max-w-full origin-top rounded-xl bg-white shadow-pop ring-1 ring-white/20 transition-transform"
        />
      ) : isTextPreviewable(mime, normalizedExt) ? (
        <ViewerTextPreview url={url} title={title} />
      ) : (
        <div className="flex max-w-md flex-col items-center gap-4 p-6 text-center text-slate-300">
          <FileWarning className="h-12 w-12" />
          <p className="text-sm leading-6">
            {isOfficeOnly(normalizedExt)
              ? t("لا يدعم المتصفح عرض ملفات Word و Excel مباشرة — نزّل الملف لفتحه في التطبيق المناسب")
              : t("لا يمكن عرض هذا النوع من الملفات داخل المتصفح")}
          </p>
          <a
            href={download}
            className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-white/20 active:scale-[0.98]"
          >{t("تنزيل الملف")}</a>
        </div>
      )}
    </div>
  );
}
