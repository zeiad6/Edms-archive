"use client";

import { Building2 } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function DepartmentsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} title="تعذّر تحميل الأقسام" icon={<Building2 className="h-7 w-7" />} />;
}
