"use client";

import { ShieldCheck } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function PermissionsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} title="تعذّر تحميل الصلاحيات" icon={<ShieldCheck className="h-7 w-7" />} />;
}
