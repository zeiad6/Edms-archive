"use client";

import { BarChart3 } from "lucide-react";
import { PageError } from "@/components/page-error";

/** Analytics dashboard error boundary. */
export default function AnalyticsError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} icon={<BarChart3 className="h-5 w-5" />} title="تعذر تحميل لوحة التحليلات" />;
}
