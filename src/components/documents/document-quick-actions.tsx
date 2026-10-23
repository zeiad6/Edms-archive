"use client";

import { useMemo, useState } from "react";
import {
  Copy,
  Check,
  QrCode,
  Printer,
  Share2,
  FileBadge,
  Download,
  Calendar,
  Building2,
  Hash,
  X,
} from "lucide-react";
import { BarcodeFormat, EncodeHintType, QRCodeWriter } from "@zxing/library";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";
import { formatDate } from "@/lib/format";

interface DocumentQuickActionsProps {
  id: number;
  title: string;
  docNumber: string | null;
  docDate: string | null;
  deptName: string | null;
  docType: string | null;
  status: string;
  version: number;
  uploaderName: string | null;
}

function QrVector({ text }: { text: string }) {
  const path = useMemo(() => {
    try {
      const hints = new Map([[EncodeHintType.MARGIN, 1]]);
      const m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints);
      let d = "";
      for (let y = 0; y < m.getHeight(); y++) {
        for (let x = 0; x < m.getWidth(); x++) {
          if (m.get(x, y)) d += `M${x},${y}h1v1h-1z`;
        }
      }
      return { d, size: m.getWidth() };
    } catch {
      return { d: "", size: 21 };
    }
  }, [text]);

  if (!path.d) {
    return (
      <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
        QR Code
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${path.size} ${path.size}`}
      className="h-44 w-44 rounded-xl bg-white p-2 shadow-sm ring-1 ring-border"
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR Code"
    >
      <path d={path.d} fill="#0f172a" />
    </svg>
  );
}

export function DocumentQuickActions({
  id,
  title,
  docNumber,
  docDate,
  deptName,
  docType,
  status,
  version,
  uploaderName,
}: DocumentQuickActionsProps) {
  useLang();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const documentUrl = typeof window !== "undefined" ? `${window.location.origin}/documents/${id}` : `/documents/${id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(documentUrl);
      setCopiedLink(true);
      toast.success(t("تم نسخ رابط المستند إلى الحافظة"));
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error(t("تعذّر نسخ الرابط"));
    }
  };

  const handleCopyNumber = async () => {
    if (!docNumber) return;
    try {
      await navigator.clipboard.writeText(docNumber);
      setCopiedNumber(true);
      toast.success(t("تم نسخ الرقم المرجعي: {n}", { n: docNumber }));
      setTimeout(() => setCopiedNumber(false), 2000);
    } catch {
      toast.error(t("تعذّر نسخ الرقم"));
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
        <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
          <span className="icon-tile h-6 w-6 bg-primary/10 text-primary [&_svg]:h-3.5 [&_svg]:w-3.5">
            <Share2 className="h-3.5 w-3.5" />
          </span>
          {t("إجراءات سريعة ومشاركة")}
        </h4>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          v{version}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        <button
          onClick={handleCopyLink}
          type="button"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground transition-all duration-150 hover:bg-muted hover:text-primary active:scale-[0.98]"
        >
          {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copiedLink ? t("تم النسخ") : t("نسخ الرابط")}</span>
        </button>

        {docNumber ? (
          <button
            onClick={handleCopyNumber}
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground transition-all duration-150 hover:bg-muted hover:text-primary active:scale-[0.98]"
          >
            {copiedNumber ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Hash className="h-3.5 w-3.5" />}
            <span>{copiedNumber ? t("تم النسخ") : t("نسخ الرقم")}</span>
          </button>
        ) : (
          <button
            onClick={() => setShowQrModal(true)}
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground transition-all duration-150 hover:bg-muted hover:text-primary active:scale-[0.98]"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>{t("رمز التحقق")}</span>
          </button>
        )}

        {docNumber && (
          <button
            onClick={() => setShowQrModal(true)}
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground transition-all duration-150 hover:bg-muted hover:text-primary active:scale-[0.98]"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>{t("رمز التحقق")}</span>
          </button>
        )}

        <button
          onClick={handlePrintSlip}
          type="button"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground transition-all duration-150 hover:bg-muted hover:text-primary active:scale-[0.98]"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>{t("طباعة بطاقة")}</span>
        </button>
      </div>

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadein">
          <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-pop animate-pop">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute end-4 top-4 rounded-xl p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileBadge className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">{t("بطاقة التحقق الرقمية")}</h3>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{title}</p>
            </div>

            <div className="my-5 flex justify-center">
              <QrVector text={documentUrl} />
            </div>

            <div className="space-y-1.5 rounded-xl bg-muted/40 p-3 text-xs">
              {docNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("الرقم المرجعي")}:</span>
                  <span className="font-mono font-semibold text-foreground">{docNumber}</span>
                </div>
              )}
              {deptName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("القسم")}:</span>
                  <span className="font-semibold text-foreground">{deptName}</span>
                </div>
              )}
              {docDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("تاريخ المستند")}:</span>
                  <span className="font-semibold text-foreground">{formatDate(docDate)}</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-md shadow-primary/25 transition hover:bg-primary/90"
              >
                <Copy className="h-3.5 w-3.5" />
                {t("نسخ الرابط")}
              </button>
              <button
                onClick={handlePrintSlip}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted"
              >
                <Printer className="h-3.5 w-3.5" />
                {t("طباعة")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
