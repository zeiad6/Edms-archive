"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Building2 } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function DepartmentsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  useLang(); // re-render on language toggle
  return <PageError {...props} title={t("تعذّر تحميل الأقسام")} icon={<Building2 className="h-7 w-7" />} />;
}
