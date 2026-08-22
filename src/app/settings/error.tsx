"use client";

import { Settings } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function SettingsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} title="تعذّر تحميل الإعدادات" icon={<Settings className="h-7 w-7" />} />;
}
