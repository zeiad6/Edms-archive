"use client";

import { Barcode, Layers, Loader2 } from "lucide-react";
import type { BarcodeStatus, ScannedPage } from "@/hooks/use-page-manager";

interface ScanStatusBannersProps {
  pages: ScannedPage[];
  barcodeStatus: BarcodeStatus;
}

/** Page counter + barcode detection lifecycle banners. */
export function ScanStatusBanners({ pages, barcodeStatus }: ScanStatusBannersProps) {
  return (
    <>
      {/* Pages counter */}
      {pages.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">
          <Layers className="h-4 w-4 shrink-0" />
          <span>
            {pages.length} {pages.length === 1 ? "صفحة" : "صفحات"} — أضف المزيد عبر
            «مسح صفحة جديدة» ورتّب بالسحب أو الأسهم
          </span>
        </div>
      )}

      {/* Barcode status */}
      {barcodeStatus === "scanning" && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          جارٍ فحص الباركود...
        </div>
      )}
      {barcodeStatus === "found" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <Barcode className="h-4 w-4" />
          تم اكتشاف باركود — سيتم تعبئة الرقم المرجعي تلقائياً
        </div>
      )}
      {barcodeStatus === "none" && pages.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-slate-500/10 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400">
          <Barcode className="h-4 w-4" />
          لم يتم العثور على باركود في الصفحة الممسوحة
        </div>
      )}
    </>
  );
}