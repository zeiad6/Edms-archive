"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { FolderTree } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function FoldersError(props: { error: Error & { digest?: string }; reset: () => void }) {
  useLang(); // re-render on language toggle
  return <PageError {...props} title={t("تعذّر تحميل المجلدات")} icon={<FolderTree className="h-7 w-7" />} />;
}
