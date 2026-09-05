"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Maximize2,
  Printer,
  RefreshCw,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import {
  DEFAULT_SCAN_COLOR,
  DEFAULT_SCAN_DPI,
  INPUT_CLS,
  SCAN_COLORS,
  SCAN_DPIS,
  type ScanColorId,
  type ScanDpi,
  type ScanDevice,
} from "@/lib/scanner";
import { cn } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScanPage {
  id: string;
  dataUrl: string;
}

interface HardwareScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Adopt scanned pages (in order) into the main scanner UI. */
  onAdopt: (dataUrls: string[]) => Promise<void>;
}

let _hid = 0;
function nextScanId() {
  return `hscan_${++_hid}_${Date.now()}`;
}

const CONFIRM_RESET_MS = 3000;

/**
 * Multi/single scan branch for printer/MFP scanners (WIA).
 *
 * This window is SCAN-ONLY: it owns device selection, color/DPI settings and
 * the ordered gallery (drag / up-down reorder, per-image delete, double-click
 * enlarge). It never saves — "إضافة" hands the pages to the main scanner UI,
 * where archiving (الإيداع) happens from the single save form.
 */
export function HardwareScanDialog({ open, onOpenChange, onAdopt }: HardwareScanDialogProps) {
  useLang(); // re-render on language toggle
  const [devices, setDevices] = useState<ScanDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceIdx, setDeviceIdx] = useState<number>(1);
  const [dpi, setDpi] = useState<ScanDpi>(DEFAULT_SCAN_DPI);
  const [color, setColor] = useState<ScanColorId>(DEFAULT_SCAN_COLOR);

  const [pages, setPages] = useState<ScanPage[]>([]);
  const [scanning, setScanning] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [err, setErr] = useState("");

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTimer = useRef<number | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  useEffect(
    () => () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    },
    [],
  );

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const res = await fetch("/api/scan/devices");
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "تعذر سرد أجهزة المسح");
      const list: ScanDevice[] = Array.isArray(d?.devices) ? d.devices : [];
      setDevices(list);
      if (list.length > 0) {
        setDeviceIdx((prev) => (list.some((x) => x.index === prev) ? prev : list[0].index));
      }
    } catch (e) {
      setErr(e instanceof Error ? t(e.message) : t("تعذر سرد أجهزة المسح"));
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  // Enumerate devices every time the window opens.
  useEffect(() => {
    if (open) {
      setErr("");
      void loadDevices();
    }
  }, [open, loadDevices]);

  const reorderPage = useCallback((fromIdx: number, toIdx: number) => {
    setPages((prev) => {
      if (toIdx < 0 || toIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const { dragIdx, handleDragStart, handleDragOver, handleDragEnd } = useDragReorder(reorderPage);

  function resetConfirm() {
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirmId(null);
  }

  function handleDeleteClick(id: string) {
    if (confirmId === id) {
      setPages((prev) => prev.filter((p) => p.id !== id));
      resetConfirm();
    } else {
      setConfirmId(id);
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(resetConfirm, CONFIRM_RESET_MS);
    }
  }

  function openLightbox(idx: number) {
    setLightboxIdx(idx);
    setLightboxZoom(1);
  }

  // Esc closes the lightbox (keyboard parity with the document preview). No new deps.
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        setLightboxIdx((cur) => {
          if (cur === null) return cur;
          const dir = e.key === "ArrowLeft" ? 1 : -1; // RTL visual order
          return (cur + dir + pages.length) % pages.length;
        });
        setLightboxZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, pages.length]);

  /** Scan one page from the selected device and append it in scan order. */
  async function handleScan() {
    setScanning(true);
    setErr("");
    try {
      const qs = new URLSearchParams({
        device: String(deviceIdx),
        dpi: String(dpi),
        color,
      });
      const res = await fetch(`/api/scan/hardware?${qs.toString()}`);
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.image) {
        throw new Error(d?.error || "تعذر إجراء المسح الضوئي — تحقق من توصيل الطابعة/الماسح");
      }
      setPages((prev) => [...prev, { id: nextScanId(), dataUrl: d.image }]);
    } catch (e) {
      setErr(e instanceof Error ? t(e.message) : t("تعذر إجراء المسح الضوئي"));
    } finally {
      setScanning(false);
    }
  }

  /** Hand the ordered stack to the main scanner UI (deposit happens there). */
  async function handleAdopt() {
    if (pages.length === 0 || adopting) return;
    setAdopting(true);
    setErr("");
    try {
      await onAdopt(pages.map((p) => p.dataUrl));
      setPages([]);
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? t(e.message) : t("تعذر إضافة الصفحات"));
      setAdopting(false);
    }
  }

  const selectedDevice = devices.find((d) => d.index === deviceIdx);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="surface-dialog animate-pop max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl p-5 shadow-pop sm:p-6">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <Printer className="h-4 w-4" />
            </span>
            {t("المسح من الطابعة")}
            {pages.length > 0 && (
              <span className="tnum rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary ring-1 ring-inset ring-primary/20">{pages.length} {t(pages.length === 1 ? "صفحة" : "صفحات")}</span>
            )}
          </DialogTitle>
          <DialogDescription className="mt-1 leading-6">{t("امسح صفحة واحدة أو عدة صفحات — عند الانتهاء تُضاف الصفحات إلى الواجهة الرئيسية، ومن هناك يتم الإيداع في المستندات.")}</DialogDescription>
        </DialogHeader>

        {/* ── Devices + settings ─────────────────────────────── */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">{t("الأجهزة المتصلة")}</span>
              <button
                type="button"
                onClick={() => void loadDevices()}
                disabled={devicesLoading}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
                title={t("تحديث قائمة الأجهزة")}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", devicesLoading && "animate-spin")} />{t("تحديث")}</button>
            </div>
            {devicesLoading && devices.length === 0 ? (
              <div className="space-y-2" role="status" aria-label={t("جارٍ سرد الأجهزة")}>
                <div className="skeleton-shimmer h-9 rounded-xl" />
                <p className="text-xs text-muted-foreground">{t("جارٍ سرد الأجهزة...")}</p>
              </div>
            ) : devices.length === 0 ? (
              <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-5 text-muted-foreground ring-1 ring-inset ring-border/60">{t("لا توجد أجهزة مسح متصلة. تأكد من توصيل الطابعة/الماسح وتشغيله ثم اضغط تحديث.")}</p>
            ) : (
              <select
                value={deviceIdx}
                onChange={(e) => setDeviceIdx(Number(e.target.value))}
                className={INPUT_CLS}
                aria-label={t("جهاز المسح")}
              >
                {devices.map((d) => (
                  <option key={d.index} value={d.index}>
                    {d.index} · {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-border bg-muted/30 p-3.5 shadow-sm">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-foreground">{t("لون المسح")}</span>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value as ScanColorId)}
                className={INPUT_CLS}
              >
                {SCAN_COLORS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-foreground">{t("الدقة (DPI)")}</span>
              <select
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value) as ScanDpi)}
                className={INPUT_CLS}
              >
                {SCAN_DPIS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <p className="text-[11px] leading-5 text-muted-foreground">
          {selectedDevice && t("الجهاز: {name} · ", { name: selectedDevice.name })}{t("الدقة")} {dpi} DPI
        </p>

        {/* ── Scan action (the single hardware-scan button) ──── */}
        <button
          type="button"
          onClick={() => void handleScan()}
          disabled={scanning || devices.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:shadow-lg hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          {scanning ? t("جارٍ المسح...") : pages.length > 0 ? t("مسح صفحة جديدة ({n} ممسوحة)", { n: pages.length }) : t("مسح")}
        </button>

        {err && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-600 ring-1 ring-inset ring-rose-500/25 dark:text-rose-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{err}</span>
          </div>
        )}

        {/* ── Scanned gallery (scan order) ───────────────────── */}
        {pages.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <GripVertical className="h-3.5 w-3.5" />
                {t("الصور الممسوحة بالترتيب —")} {pages.length} {t(pages.length === 1 ? "صفحة" : "صفحات")} ·
                {t("اضغط مرتين على أي صورة لتكبيرها")}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPages([]);
                  resetConfirm();
                }}
                className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-rose-500"
              >{t("إفراغ الكل")}</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {pages.map((page, idx) => {
                const isConfirming = confirmId === page.id;
                return (
                  <div
                    key={page.id}
                    draggable
                    onDragStart={() => {
                      resetConfirm();
                      handleDragStart(idx);
                    }}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDoubleClick={() => openLightbox(idx)}
                    title={t("اضغط مرتين للتكبير")}
                    aria-label={t("صفحة ممسوحة {i} من {n} — اضغط مرتين للتكبير", { i: idx + 1, n: pages.length })}
                    className={cn(
                      "group relative cursor-zoom-in overflow-hidden rounded-xl border border-border bg-muted transition hover:border-primary/50",
                      dragIdx === idx && "opacity-50",
                    )}
                  >
                    <div className="absolute left-1 top-1 z-10 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <GripVertical className="h-3 w-3 text-white/60" />
                      {idx + 1} / {pages.length}
                    </div>
                    <button
                      type="button"
                      draggable={false}
                      onClick={() => openLightbox(idx)}
                      title={t("تكبير")}
                      aria-label={t("تكبير صفحة {i}", { i: idx + 1 })}
                      className="absolute right-1 top-1 z-10 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-primary"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-1 left-1 z-10 flex gap-1">
                      <button
                        type="button"
                        draggable={false}
                        disabled={idx === 0}
                        onClick={() => {
                          reorderPage(idx, idx - 1);
                          resetConfirm();
                        }}
                        title={t("تحريك لأعلى")}
                        aria-label={t("تحريك صفحة {i} لأعلى", { i: idx + 1 })}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        draggable={false}
                        disabled={idx === pages.length - 1}
                        onClick={() => {
                          reorderPage(idx, idx + 1);
                          resetConfirm();
                        }}
                        title={t("تحريك لأسفل")}
                        aria-label={t("تحريك صفحة {i} لأسفل", { i: idx + 1 })}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      draggable={false}
                      onClick={() => handleDeleteClick(page.id)}
                      title={isConfirming ? t("اضغط مرة أخرى للتأكيد") : t("حذف الصورة")}
                      aria-label={isConfirming ? t("تأكيد حذف صفحة {i}", { i: idx + 1 }) : t("حذف صفحة {i}", { i: idx + 1 })}
                      className={cn(
                        "absolute bottom-1 right-1 z-10 inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-semibold text-white transition",
                        isConfirming
                          ? "bg-rose-600 hover:bg-rose-700"
                          : "bg-black/60 opacity-80 hover:bg-rose-600 hover:opacity-100",
                      )}
                    >
                      {isConfirming ? t("تأكيد؟") : <Trash2 className="h-3 w-3" />}
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.dataUrl}
                      alt={t("صفحة ممسوحة {i}", { i: idx + 1 })}
                      draggable={false}
                      loading="lazy"
                      className="h-36 w-full object-cover"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <span aria-hidden className="mesh-dots pointer-events-none absolute inset-0 opacity-40" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary/60 ring-1 ring-inset ring-primary/15">
              <Printer className="h-6 w-6" />
            </span>
            <p className="relative text-sm font-medium text-foreground">{t("لا توجد صور ممسوحة بعد")}</p>
            <p className="relative text-xs text-muted-foreground">{t("اضغط «مسح» لبدء المسح — ستظهر الصفحات هنا بالترتيب")}</p>
          </div>
        )}

        {/* ── Adopt into the main UI (deposit happens there) ─── */}
        <button
          type="button"
          onClick={() => void handleAdopt()}
          disabled={adopting || scanning || pages.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-md transition hover:shadow-lg hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adopting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {adopting ? t("جارٍ الإضافة...") : t("إضافة إلى الواجهة الرئيسية ({n})", { n: pages.length })}
        </button>

        {/* ── Lightbox (double-click enlarge) ────────────────── */}
        {lightboxIdx !== null && pages[lightboxIdx] && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => setLightboxIdx(null)}
            role="dialog"
            aria-modal="true"
            aria-label={t("تكبير صفحة {i}", { i: lightboxIdx + 1 })}
          >
            <div
              className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-xl bg-black/50 p-1.5 backdrop-blur"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(z + 0.25, 3))}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={t("تكبير")}
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(z - 0.25, 0.25))}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={t("تصغير")}
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="mx-1 h-5 w-px bg-white/20" />
              <button
                type="button"
                onClick={() => setLightboxIdx(null)}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={t("إغلاق")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/70 backdrop-blur">
              {t("صفحة {i} من {n} · {p}%", { i: lightboxIdx + 1, n: pages.length, p: Math.round(lightboxZoom * 100) })}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pages[lightboxIdx].dataUrl}
              alt={t("صفحة ممسوحة مكبرة {i}", { i: lightboxIdx + 1 })}
              onClick={(e) => e.stopPropagation()}
              style={{ transform: `scale(${lightboxZoom})` }}
              className="max-h-[85vh] max-w-[90vw] select-none rounded-lg bg-white shadow-2xl transition-transform duration-200"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
