"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarcodeFormat, EncodeHintType, QRCodeWriter } from "@zxing/library";
import { QrCode, Smartphone, Trash2, Wifi, Globe } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui";
import { useLang } from "@/components/lang-provider";
import { t } from "@/lib/i18n";

interface MobileStatus {
  enabled: boolean;
  running: boolean;
  error: string;
  port: number;
  publicHost: string;
  addresses: string[];
  fingerprint: string;
  devices: { id: string; name: string; createdAt: string; lastSeenAt: string | null }[];
}

interface MobileBridge {
  status(): Promise<MobileStatus>;
  setEnabled(on: boolean): Promise<MobileStatus>;
  setPublicHost(host: string): Promise<MobileStatus>;
  newPairing(): Promise<{ uri: string; expiresAt: number }>;
  revoke(id: string): Promise<MobileStatus>;
}

/** Only the Electron preload defines this — the phone and plain browsers never do. */
function bridge(): MobileBridge | null {
  return typeof window === "undefined" ? null : ((window as unknown as { edmsMobile?: MobileBridge }).edmsMobile ?? null);
}

function QrSvg({ text }: { text: string }) {
  const path = useMemo(() => {
    const hints = new Map([[EncodeHintType.MARGIN, 2]]);
    const m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints);
    let d = "";
    for (let y = 0; y < m.getHeight(); y++)
      for (let x = 0; x < m.getWidth(); x++) if (m.get(x, y)) d += `M${x},${y}h1v1h-1z`;
    return { d, size: m.getWidth() };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${path.size} ${path.size}`} className="h-56 w-56 rounded-xl bg-white" shapeRendering="crispEdges" role="img" aria-label="QR">
      <path d={path.d} fill="#000" />
    </svg>
  );
}

/**
 * Settings → pair the EDMS Android app with this desktop (LAN or Internet).
 * Security model lives in electron/mobile-gateway.cjs.
 */
export function MobileLinkCard() {
  useLang();
  const [api, setApi] = useState<MobileBridge | null>(null);
  const [st, setSt] = useState<MobileStatus | null>(null);
  const [pair, setPair] = useState<{ uri: string; expiresAt: number } | null>(null);
  const [host, setHost] = useState("");

  const run = useCallback(async (p: Promise<MobileStatus>) => {
    try {
      const s = await p;
      setSt(s);
      setHost(s.publicHost);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const b = bridge();
    setApi(b);
    if (b) void run(b.status());
  }, [run]);

  if (!api || !st) return null;

  async function newCode() {
    try {
      setPair(await api!.newPairing());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card className="p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
        <Smartphone className="h-4 w-4 text-primary" />
        {t("ربط تطبيق الجوال (Android)")}
      </h3>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {t("اتصال مشفّر (TLS) مع تثبيت بصمة الشهادة، ورمز جهاز لكل هاتف، ثم تسجيل الدخول المعتاد. الخدمة متوقفة افتراضياً.")}
      </p>

      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={st.enabled}
          onChange={(e) => {
            setPair(null);
            void run(api.setEnabled(e.target.checked));
          }}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        {t("السماح لتطبيق الجوال بالاتصال بهذا الجهاز")}
        <span className={st.running ? "text-emerald-600" : "text-muted-foreground"}>
          {st.running ? t("يعمل") : t("متوقف")}
        </span>
      </label>
      {st.error && <p className="mt-2 text-xs text-rose-600">{st.error}</p>}

      {st.enabled && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
              <Wifi className="h-4 w-4 text-primary" />
              <span>{t("الشبكة المحلية")}:</span>
              <span dir="ltr" className="font-mono">
                {st.addresses.map((a) => `${a}:${st.port}`).join(" · ") || "—"}
              </span>
            </div>
            <form
              className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(api.setPublicHost(host));
              }}
            >
              <Globe className="h-4 w-4 text-primary" />
              <input
                dir="ltr"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder={t("عنوان الإنترنت (اختياري) مثل my.ddns.net")}
                className="min-w-0 flex-1 bg-transparent font-mono outline-none"
              />
              <button type="submit" className="font-semibold text-primary">
                {t("حفظ")}
              </button>
            </form>
          </div>

          <div className="flex flex-wrap items-start gap-5">
            <div className="space-y-2">
              <button
                type="button"
                onClick={newCode}
                disabled={!st.running}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                <QrCode className="h-4 w-4" />
                {t("إنشاء رمز اقتران جديد")}
              </button>
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                {t("افتح تطبيق «أرشيف» على الهاتف واضغط «مسح رمز الاقتران». الرمز صالح 10 دقائق ولمرة واحدة.")}
              </p>
              <p className="max-w-xs break-all text-[10px] text-muted-foreground" dir="ltr">
                SHA-256: {st.fingerprint.match(/.{2}/g)?.join(":")}
              </p>
            </div>
            {pair && <QrSvg text={pair.uri} />}
          </div>

          <div>
            <div className="mb-2 text-xs font-bold">{t("الأجهزة المقترنة")}</div>
            {st.devices.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("لا توجد أجهزة")}</p>
            ) : (
              <ul className="space-y-1.5">
                {st.devices.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-xs">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{d.name}</span>
                    <span className="text-muted-foreground" dir="ltr">
                      {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void run(api.revoke(d.id))}
                      aria-label={t("إلغاء الاقتران")}
                      title={t("إلغاء الاقتران")}
                      className="ms-auto rounded-md p-1 text-rose-600 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
