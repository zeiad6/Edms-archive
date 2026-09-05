"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { AlertTriangle, Camera, Loader2, Printer, RefreshCw, RotateCw, ScanLine, X } from "lucide-react";
import { cn } from "@/lib/format";

interface CameraPanelProps {
  cameraActive: boolean;
  scanning: boolean;
  scanError: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onStartScan: () => void;
  onStopCamera: () => void;
  onCapture: () => void;
  onToggleFacing: () => void;
  onSimulate: () => void;
  onOpenMultiScan: () => void;
}

/**
 * Camera / scan area — live viewfinder, capture, simulation, and the single
 * entry point to printer scanning (the multi/single scan window, which hands
 * its pages back to the main UI for deposit).
 */

const BTN_PRIMARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-7 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all duration-150 hover:-translate-y-px hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const BTN_TINT =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary/10 px-5 text-sm font-bold text-primary shadow-sm ring-1 ring-inset ring-primary/20 transition-all duration-150 hover:bg-primary/20 hover:shadow active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const BTN_GHOST =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition-all duration-150 hover:bg-muted hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export function CameraPanel({
  cameraActive,
  scanning,
  scanError,
  videoRef,
  canvasRef,
  onStartScan,
  onStopCamera,
  onCapture,
  onToggleFacing,
  onSimulate,
  onOpenMultiScan,
}: CameraPanelProps) {
  useLang(); // re-render on language toggle
  return (
    <section aria-label={t("الماسحة الضوئية")} className="rounded-3xl border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-sm font-extrabold tracking-tight text-foreground">
          <span className="icon-tile h-9 w-9 rounded-xl">
            <Camera className="h-4 w-4" />
          </span>{t("الماسحة الضوئية")}<span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
              cameraActive
                ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400"
                : "bg-muted text-muted-foreground ring-border",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", cameraActive ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50")} />
            {cameraActive ? t("الكاميرا نشطة") : t("الكاميرا متوقفة")}
          </span>
        </h3>
        {cameraActive && (
          <button
            type="button"
            onClick={onStopCamera}
            aria-label={t("إيقاف الكاميرا")}
            title={t("إيقاف الكاميرا")}
            className="rounded-lg p-1.5 text-muted-foreground ring-1 ring-transparent transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {cameraActive ? (
        <>
          <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-inset ring-black/20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              aria-label={t("معاينة الكاميرا الحية")}
              className="h-[300px] w-full bg-black object-cover"
            />
            {/* Viewfinder corner guides (decorative) */}
            <span aria-hidden className="pointer-events-none absolute inset-3">
              <i className="absolute start-0 top-0 h-6 w-6 rounded-tl-lg border-s-2 border-t-2 border-white/80" />
              <i className="absolute end-0 top-0 h-6 w-6 rounded-tr-lg border-e-2 border-t-2 border-white/80" />
              <i className="absolute bottom-0 start-0 h-6 w-6 rounded-bl-lg border-b-2 border-s-2 border-white/80" />
              <i className="absolute bottom-0 end-0 h-6 w-6 rounded-br-lg border-b-2 border-e-2 border-white/80" />
            </span>
            <span className="absolute bottom-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">{t("وجّه المستند داخل الإطار ثم اضغط التقاط")}</span>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button type="button" onClick={onCapture} disabled={scanning} className={BTN_PRIMARY}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {t("التقاط صورة")}
            </button>
            <button type="button" onClick={onToggleFacing} className={BTN_GHOST} aria-label={t("تبديل الكاميرا")}>
              <RotateCw className="h-4 w-4" />{t("تبديل الكاميرا")}</button>
            <button
              type="button"
              onClick={onOpenMultiScan}
              className={BTN_TINT}
              title={t("نافذة المسح من الطابعة: فردي أو متعدد — قائمة الأجهزة + اللون والدقة")}
            >
              <Printer className="h-4 w-4" />{t("مسح من الطابعة")}</button>
            <button type="button" onClick={onSimulate} disabled={scanning} className={BTN_GHOST}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t("محاكاة مسح")}
            </button>
          </div>
        </>
      ) : (
        <div className="relative flex min-h-[300px] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <span aria-hidden className="mesh-dots pointer-events-none absolute inset-0 opacity-40" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            <ScanLine className="h-7 w-7" />
          </span>
          <p className="relative max-w-sm text-sm font-medium text-foreground">{t("جاهز للمسح — اختر مصدر الصفحات")}</p>
          <p className="relative max-w-sm text-xs leading-5 text-muted-foreground">{t("امسح صفحة تلو الأخرى — تتجمع الصفحات في القائمة بالترتيب، ويمكنك إعادة ترتيبها قبل الإيداع")}</p>
          <div className="relative mt-1 flex flex-wrap items-center justify-center gap-2.5">
            <button type="button" onClick={onStartScan} className={BTN_PRIMARY}>
              <Camera className="h-4 w-4" />{t("تشغيل الكاميرا")}</button>
            <button
              type="button"
              onClick={onOpenMultiScan}
              className={BTN_TINT}
              title={t("نافذة المسح من الطابعة: فردي أو متعدد — قائمة الأجهزة + اللون والدقة")}
            >
              <Printer className="h-4 w-4" />{t("مسح من الطابعة")}</button>
            <button type="button" onClick={onSimulate} disabled={scanning} className={BTN_GHOST}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t("محاكاة مسح")}
            </button>
          </div>
          {scanning && (
            <p role="status" className="relative inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />{t("جارٍ جلب صورة المحاكاة...")}</p>
          )}
        </div>
      )}

      {/* Scan error banner — surfaced from scanner-client state (same visual
          pattern as status-banners.tsx) so failures show right at the action. */}
      {scanError && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-600 ring-1 ring-inset ring-rose-500/25 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{scanError}</span>
        </div>
      )}
    </section>
  );
}
