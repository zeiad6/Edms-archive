"use client";

import { useEffect, useState } from "react";
import { SignaturePad, SignatureDisplay } from "./signature-pad";

interface SigItem {
  id: number;
  label: string | null;
  dataUrl: string;
  createdAt: string;
}

export function SignaturesSection({ documentId }: { documentId: number }) {
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

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">التوقيعات السابقة</h4>
        {loading ? (
          <p className="text-xs text-muted-foreground">جارٍ التحميل...</p>
        ) : sigs.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا توجد توقيعات بعد.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {sigs.map((s) => (
              <SignatureDisplay key={s.id} dataUrl={s.dataUrl} label={s.label} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
