"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useEffect } from "react";
import { Hash, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TagsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useLang(); // re-render on language toggle
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
        <Hash className="h-7 w-7" />
      </div>
      <h2 className="font-bold text-foreground">{t("تعذّر تحميل الوسوم")}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("حدث خطأ أثناء تحميل قائمة الوسوم. يرجى المحاولة مرة أخرى.")}</p>
      <Button onClick={reset} className="mt-5">
        <RotateCcw className="h-4 w-4" />{t("إعادة المحاولة")}</Button>
    </div>
  );
}
