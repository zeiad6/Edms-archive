"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

/** Reusable error boundary for route segments. */
export function PageError({
  error,
  reset,
  title = "تعذّر تحميل الصفحة",
  message = "حدث خطأ أثناء تحميل هذه الصفحة. يرجى المحاولة مرة أخرى.",
  icon,
}: PageErrorProps) {
  useLang(); // re-render on language toggle
  // Client-side navigation back to the dashboard. `window.location.assign()`
  // forces a full document reload here, which re-runs the session gate and
  // discards any client state the boundary was already holding.
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[46vh] w-full max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 ring-1 ring-inset ring-rose-500/20">
        {icon ?? <AlertTriangle className="h-7 w-7" />}
        <span aria-hidden className="absolute -inset-2 rounded-3xl bg-rose-500/5 blur-xl" />
      </div>
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">{t(title)}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{t(message)}</p>
      {error?.digest && <p dir="ltr" className="tnum mt-2 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">#{error.digest}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" />{t("إعادة المحاولة")}</Button>
        <Button variant="outline" onClick={() => router.push("/")}>{t("العودة للرئيسية")}</Button>
      </div>
    </div>
  );
}
