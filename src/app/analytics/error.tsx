"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { BarChart3 } from "lucide-react";
import { PageError } from "@/components/page-error";

/** Analytics dashboard error boundary. */
export default function AnalyticsError({ error, reset }: { error: Error; reset: () => void }) {
  useLang(); // re-render on language toggle
  return <PageError error={error} reset={reset} icon={<BarChart3 className="h-5 w-5" />} title={t("تعذر تحميل لوحة التحليلات")} />;
}
