"use client";

import { ScanLine } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function ScanError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} title="تعذّر تحميل واجهة المسح" icon={<ScanLine className="h-7 w-7" />} />;
}
