"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useEffect, useState } from "react";
import { SignaturePad, SignatureDisplay } from "./signature-pad";

interface SigItem {
  id: number;
  label: string | null;
  dataUrl: string;
  createdAt: string;
}

export function SignaturesSection({ documentId }: { documentId: number }) {
  useLang(); // re-render on language toggle
  const [sigs, setSigs] = useState<SigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/signatures?documentId=${documentId}`)
      .then((r) => r.json())
      .then((data) => setSigs(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [documentId, refreshKey]);

  return (
    <div className="space-y-4 px-1 pb-1 pt-4">
      <SignaturePad documentId={documentId} onSigned={() => setRefreshKey((k) => k + 1)} />

      <div className="space-y-2.5">
        <h4 className="flex items-center gap-2 text-xs font-bold text-muted-foreground">{t("التوقيعات السابقة")}</h4>
        {loading ? (
          <p className="animate-pulse text-xs text-muted-foreground">{t("جارٍ التحميل...")}</p>
        ) : sigs.length === 0 ? (
          <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-center text-xs text-muted-foreground ring-1 ring-inset ring-border/40">{t("لا توجد توقيعات بعد.")}</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {sigs.map((s) => (
              <SignatureDisplay key={s.id} dataUrl={s.dataUrl} label={s.label} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
