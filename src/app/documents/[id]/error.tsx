"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import Link from "next/link";
import { useEffect } from "react";
import { FileText, RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DocumentDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useLang(); // re-render on language toggle
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
        <FileText className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-bold text-foreground">{t("تعذّر تحميل تفاصيل المستند")}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("حدث خطأ أثناء تحميل هذه الصفحة. قد يكون المستند محذوفاً أو أن المشكلة مؤقتة.")}</p>
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" />{t("إعادة المحاولة")}</Button>
        <Button asChild variant="outline">
          <Link href="/documents">
            <ArrowRight className="h-4 w-4" />{t("العودة للقائمة")}</Link>
        </Button>
      </div>
    </div>
  );
}
