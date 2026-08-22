"use client";

import { UploadCloud } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function UploadError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} title="تعذّر تحميل واجهة الرفع" icon={<UploadCloud className="h-7 w-7" />} />;
}
