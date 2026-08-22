"use client";

import { useState, useCallback } from "react";
import { scanBarcodeFromDataUrl, parseDocumentRefFromBarcode } from "@/lib/barcode-scanner";

/** A single scanned page with optional barcode metadata. */
export interface ScannedPage {
  id: string;
  dataUrl: string;
  barcode?: { format: string; text: string } | null;
}

/** Barcode detection lifecycle state. */
export type BarcodeStatus = "idle" | "scanning" | "found" | "none";

let _pid = 0;
function nextId() {
  return `page_${++_pid}_${Date.now()}`;
}

/**
 * Manages scanned page state: add (with barcode detection), remove,
 * reorder (drag), clear, and barcode status tracking.
 */
export function usePageManager(docNumberRef?: React.RefObject<HTMLInputElement | null>) {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [barcodeStatus, setBarcodeStatus] = useState<BarcodeStatus>("idle");

  /**
   * Append a scanned page and attempt barcode detection on the image.
   * If a barcode is found and contains a document reference, the
   * `docNumberRef` input is auto-filled.
   */
  const addPageWithBarcode = useCallback(
    async (dataUrl: string, fallbackDocNumber?: string) => {
      setBarcodeStatus("scanning");
      let barcode: { format: string; text: string } | null = null;

      try {
        const result = await scanBarcodeFromDataUrl(dataUrl);
        if (result) {
          barcode = { format: result.format, text: result.text };
          setBarcodeStatus("found");

          const parsed = parseDocumentRefFromBarcode(result.text);
          if (parsed.isValid && parsed.docNumber && docNumberRef?.current) {
            docNumberRef.current.value = parsed.docNumber;
          }
        } else {
          setBarcodeStatus("none");
          if (fallbackDocNumber && docNumberRef?.current) {
            docNumberRef.current.value = fallbackDocNumber;
          }
        }
      } catch {
        setBarcodeStatus("none");
        if (fallbackDocNumber && docNumberRef?.current) {
          docNumberRef.current.value = fallbackDocNumber;
        }
      }

      setPages((prev) => [...prev, { id: nextId(), dataUrl, barcode }]);
    },
    [docNumberRef],
  );

  /** Remove a single page by its ID. */
  const removePage = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /** Move a page from `fromIdx` to `toIdx`. */
  const reorderPage = useCallback((fromIdx: number, toIdx: number) => {
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  /** Reset all state. */
  const clearAll = useCallback(() => {
    setPages([]);
    setBarcodeStatus("idle");
  }, []);

  return {
    pages,
    barcodeStatus,
    addPageWithBarcode,
    removePage,
    reorderPage,
    clearAll,
    setBarcodeStatus,
  } as const;
}
