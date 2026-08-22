"use client";

import { AlertTriangle, Camera, Loader2, Printer, RefreshCw, RotateCw, ScanLine, X } from "lucide-react";

interface CameraPanelProps {
  cameraActive: boolean;
  scanning: boolean;
  pageCount: number;
  scanError: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onStartScan: () => void;
  onStopCamera: () => void;
  onCapture: () => void;
  onToggleFacing: () => void;
  onSimulate: () => void;
  onHardwareScan: () => void;
}

/** Camera / scan area — live viewfinder, capture, simulation, and WIA hardware scan. */
export function CameraPanel({
  cameraActive,
  scanning,
  pageCount,
  scanError,
  videoRef,
  canvasRef,
  onStartScan,
  onStopCamera,
  onCapture,
  onToggleFacing,
  onSimulate,
  onHardwareScan,
}: CameraPanelProps) {
  /** Once a document is in progress, the scanner adds another page to the list. */
  const scanMoreLabel = pageCount > 0 ? "مسح صفحة جديدة" : "مسح من الماسح الضوئي";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Camera className="h-4 w-4 text-primary" /> الماسحة الضوئية
        </h3>
        {cameraActive && (
          <button
            onClick={onStopCamera}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="إيقاف الكاميرا"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {cameraActive ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="h-[300px] w-full rounded-xl bg-black/5 object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onCapture}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              التقاط صورة
            </button>
            <button
              onClick={onToggleFacing}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <RotateCw className="h-4 w-4" />
              تبديل الكاميرا
            </button>
            <button
              onClick={onHardwareScan}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
              title="مسح صفحة من ماسح ضوئي متصل بالجهاز (WIA)"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {scanMoreLabel}
            </button>
            <button
              onClick={onSimulate}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              محاكاة مسح
            </button>
          </div>
        </>
      ) : (
        <div className="flex h-[300px] w-full flex-col items-center justify-center gap-3 rounded-xl bg-muted/20">
          <ScanLine className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-center text-sm text-muted-foreground">
            امسح صفحة تلو الأخرى — تتجمع الصفحات في القائمة بالترتيب
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onStartScan}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <Camera className="h-4 w-4" />
              تشغيل الكاميرا
            </button>
            <button
              onClick={onHardwareScan}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
              title="مسح صفحة من ماسح ضوئي متصل بالجهاز (WIA)"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {scanMoreLabel}
            </button>
            <button
              onClick={onSimulate}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              محاكاة مسح
            </button>
          </div>
        </div>
      )}

      {/* Scan error banner — surfaced from scanner-client state (same visual
          pattern as status-banners.tsx) so failures show right at the action. */}
      {scanError && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {scanError}
        </div>
      )}
    </div>
  );
}