"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Barcode, Layers, Loader2 } from "lucide-react";

import type { BarcodeStatus, ScannedPage } from "@/hooks/use-page-manager";

interface ScanStatusBannersProps {
  pages: ScannedPage[];
  barcodeStatus: BarcodeStatus;
}

const BANNER =
  "flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-soft ring-1 ring-inset";

/** Page counter + barcode detection lifecycle banners. */
export function ScanStatusBanners({ pages, barcodeStatus }: ScanStatusBannersProps) {
  useLang(); // re-render on language toggle
  return (
    <div className="space-y-2.5" aria-live="polite">
      {/* Pages counter */}
      {pages.length > 0 && (
        <div role="status" className={`${BANNER} bg-indigo-500/10 text-indigo-600 ring-indigo-500/25 dark:text-indigo-400`}>
          <Layers className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {pages.length} {t(pages.length === 1 ? "صفحة" : "صفحات")} {t("— أضف المزيد عبر «مسح صفحة جديدة» ورتّب بالسحب أو الأسهم")}
          </span>
        </div>
      )}

      {/* Barcode status */}
      {barcodeStatus === "scanning" && (
        <div role="status" className={`${BANNER} bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-400`}>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />{t("جارٍ فحص الباركود...")}</div>
      )}
      {barcodeStatus === "found" && (
        <div role="status" className={`${BANNER} bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400`}>
          <Barcode className="h-4 w-4 shrink-0" />{t("تم اكتشاف باركود — سيتم تعبئة الرقم المرجعي تلقائياً")}</div>
      )}
      {barcodeStatus === "none" && pages.length > 0 && (
        <div role="status" className={`${BANNER} bg-slate-500/10 text-slate-600 ring-slate-500/25 dark:text-slate-400`}>
          <Barcode className="h-4 w-4 shrink-0" />{t("لم يتم العثور على باركود في الصفحة الممسوحة")}</div>
      )}
    </div>
  );
}
