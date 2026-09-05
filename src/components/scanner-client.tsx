"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { saveScannedDocument, saveScannedPdfDocument } from "@/actions/documents";
import { useCamera } from "@/hooks/use-camera";
import { usePageManager } from "@/hooks/use-page-manager";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { scannedDataUrlsToPdfDataUrl } from "@/lib/scan-pdf";
import { buildSavePayload, type Option } from "@/lib/scanner";
import { CameraPanel } from "@/components/scanner/camera-panel";
import { HardwareScanDialog } from "@/components/scanner/hardware-scan-dialog";
import { ScanStatusBanners } from "@/components/scanner/status-banners";
import { PagesGrid } from "@/components/scanner/pages-grid";
import { SaveForm } from "@/components/scanner/save-form";

export function ScannerClient({
  departments,
  folders,
  docTypes,
}: {
  departments: Option[];
  folders: Option[];
  docTypes: string[];
}) {
  useLang(); // re-render on language toggle
  const router = useRouter();
  const docNumberRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);

  const {
    videoRef,
    canvasRef,
    cameraActive,
    startCamera,
    stopCamera,
    capturePhoto,
    toggleFacingMode,
  } = useCamera();

  const {
    pages,
    barcodeStatus,
    addPageWithBarcode,
    removePage,
    reorderPage,
  } = usePageManager(docNumberRef);

  const { dragIdx, handleDragStart, handleDragOver, handleDragEnd } =
    useDragReorder(reorderPage);

  // ─── Actions ─────────────────────────────────────────────────────────

  /** Start camera or capture a photo if already active. */
  function handleStartScan() {
    if (cameraActive) {
      const dataUrl = capturePhoto();
      if (dataUrl) addPageWithBarcode(dataUrl);
    } else {
      startCamera().catch((e: Error) => setErr(t(e.message)));
    }
  }

  /** Capture the current camera frame and add it as a page. */
  function handleCapture() {
    const dataUrl = capturePhoto();
    if (dataUrl) addPageWithBarcode(dataUrl);
  }

  /** Simulate scan via API (fallback when camera is unavailable). */
  async function handleSimulateScan() {
    setScanning(true);
    setErr("");
    try {
      const res = await fetch("/api/scan");
      const d = await res.json();
      if (!res.ok || !d.image) throw new Error(d.error || "تعذرت محاكاة المسح");
      await addPageWithBarcode(d.image, d.docNumber);
    } catch (e) {
      setErr(e instanceof Error ? t(e.message) : t("تعذرت محاكاة المسح"));
    } finally {
      setScanning(false);
    }
  }

  /**
   * Adopt pages scanned in the printer multi-scan window into the main queue,
   * preserving their order (barcode detection runs per page as usual).
   */
  async function handleAdoptScans(dataUrls: string[]) {
    for (const u of dataUrls) {
      await addPageWithBarcode(u);
    }
  }

  /**
   * Deposit the queued pages to the archive (the single save point).
   * One page → image document; several pages → merged into one PDF document.
   */
  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pages.length === 0) return;
    setBusy(true);
    setErr("");
    const fd = new FormData(e.currentTarget);
    try {
      if (pages.length > 1) {
        const pdfUrl = await scannedDataUrlsToPdfDataUrl(pages.map((p) => p.dataUrl));
        const payload = buildSavePayload(fd, pdfUrl);
        const res = await saveScannedPdfDocument({ ...payload, pageCount: pages.length });
        if (!res?.id) throw new Error(t("فشل الحفظ — لم يتم إنشاء المستند"));
        toast.success(t("تم حفظ المستند الممسوح بنجاح"));
        router.refresh();
      } else {
        const res = await saveScannedDocument(buildSavePayload(fd, pages[0].dataUrl));
        // The action can resolve with `{ id: undefined }` if the insert failed
        // silently — treat that as an error so `busy` is always released.
        if (!res?.id) throw new Error(t("فشل الحفظ — لم يتم إنشاء المستند"));
        toast.success(t("تم حفظ المستند الممسوح بنجاح"));
        router.refresh();
      }
    } catch (e) {
      const msg = e instanceof Error ? t(e.message) : t("فشل الحفظ");
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="grid gap-5 lg:grid-cols-5 lg:gap-6 2xl:gap-8">
      <div className="space-y-5 lg:col-span-3 lg:space-y-6">
        <CameraPanel
          cameraActive={cameraActive}
          scanning={scanning}
          scanError={err}
          videoRef={videoRef}
          canvasRef={canvasRef}
          onStartScan={handleStartScan}
          onStopCamera={stopCamera}
          onCapture={handleCapture}
          onToggleFacing={toggleFacingMode}
          onSimulate={handleSimulateScan}
          onOpenMultiScan={() => setMultiOpen(true)}
        />

        <HardwareScanDialog
          open={multiOpen}
          onOpenChange={setMultiOpen}
          onAdopt={handleAdoptScans}
        />

        <ScanStatusBanners pages={pages} barcodeStatus={barcodeStatus} />

        {pages.length > 0 && (
          <PagesGrid
            pages={pages}
            dragIdx={dragIdx}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onMovePage={reorderPage}
            onRemovePage={removePage}
          />
        )}

        {err && (
          <div role="alert" className="flex items-center gap-2.5 rounded-2xl bg-rose-500/10 px-4 py-3.5 text-sm font-medium text-rose-600 shadow-sm ring-1 ring-inset ring-rose-500/25 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
          </div>
        )}
      </div>

      <SaveForm
        departments={departments}
        folders={folders}
        docTypes={docTypes}
        busy={busy}
        pageCount={pages.length}
        docNumberRef={docNumberRef}
        onSave={handleSave}
      />
    </div>
  );
}