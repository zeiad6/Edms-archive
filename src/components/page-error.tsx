"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
        {icon ?? <AlertTriangle className="h-7 w-7" />}
      </div>
      <h2 className="font-bold text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button onClick={reset} className="mt-5">
        <RotateCcw className="h-4 w-4" /> إعادة المحاولة
      </Button>
    </div>
  );
}
