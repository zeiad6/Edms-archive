"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { ShieldCheck } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function PermissionsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  useLang(); // re-render on language toggle
  return <PageError {...props} title={t("تعذّر تحميل الصلاحيات")} icon={<ShieldCheck className="h-7 w-7" />} />;
}
