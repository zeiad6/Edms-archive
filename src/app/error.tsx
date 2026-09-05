"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useLang(); // re-render on language toggle
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-bold text-foreground">{t("حدث خطأ غير متوقع")}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("تعذّر تحميل هذه الصفحة. يمكنك المحاولة مرة أخرى، أو العودة لاحقاً.")}</p>
      <Button onClick={reset} className="mt-5">
        <RotateCcw className="h-4 w-4" />{t("إعادة المحاولة")}</Button>
    </div>
  );
}
