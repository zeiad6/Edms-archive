"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { saveScannedDocument } from "@/actions/documents";
import { useCamera } from "@/hooks/use-camera";
import { usePageManager } from "@/hooks/use-page-manager";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { buildSavePayload, type Option } from "@/lib/scanner";
import { CameraPanel } from "@/components/scanner/camera-panel";
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
  const router = useRouter();
  const docNumberRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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
      startCamera().catch((e: Error) => setErr(e.message));
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
      setErr(e instanceof Error ? e.message : "تعذرت محاكاة المسح");
    } finally {
      setScanning(false);
    }
  }

  /** Scan a real page from a WIA scanner connected to this machine. */
  async function handleHardwareScan() {
    setScanning(true);
    setErr("");
    try {
      const res = await fetch("/api/scan/hardware");
      // The API returns distinct Arabic errors per failure mode (no scanner
      // found, WIA unavailable, generic). Parse the JSON body and surface the
      // server's message; fall back to a generic message when the body is not
      // JSON (e.g. a non-JSON 500 page).
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.image) {
        throw new Error(
          d?.error || "تعذر إجراء المسح الضوئي — تحقق من توصيل الطابعة/الماسح",
        );
      }
      await addPageWithBarcode(d.image, d.docNumber);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "تعذر إجراء المسح الضوئي — تحقق من توصيل الطابعة/الماسح",
      );
    } finally {
      setScanning(false);
    }
  }

  /** Save scanned document to the archive. */
  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pages.length === 0) return;
    setBusy(true);
    setErr("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await saveScannedDocument(buildSavePayload(fd, pages[0].dataUrl));
      // The action can resolve with `{ id: undefined }` if the insert failed
      // silently — treat that as an error so `busy` is always released.
      if (!res?.id) throw new Error("فشل الحفظ — لم يتم إنشاء المستند");
      router.push(`/documents/${res.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل الحفظ");
      setBusy(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <CameraPanel
          cameraActive={cameraActive}
          scanning={scanning}
          pageCount={pages.length}
          scanError={err}
          videoRef={videoRef}
          canvasRef={canvasRef}
          onStartScan={handleStartScan}
          onStopCamera={stopCamera}
          onCapture={handleCapture}
          onToggleFacing={toggleFacingMode}
          onSimulate={handleSimulateScan}
          onHardwareScan={handleHardwareScan}
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
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" /> {err}
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