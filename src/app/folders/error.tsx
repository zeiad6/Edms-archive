"use client";

import { FolderTree } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function FoldersError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} title="تعذّر تحميل المجلدات" icon={<FolderTree className="h-7 w-7" />} />;
}
