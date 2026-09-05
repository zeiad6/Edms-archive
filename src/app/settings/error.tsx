"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Settings } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function SettingsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  useLang(); // re-render on language toggle
  return <PageError {...props} title={t("تعذّر تحميل الإعدادات")} icon={<Settings className="h-7 w-7" />} />;
}
