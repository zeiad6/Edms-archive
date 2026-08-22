"use client";

import { Users } from "lucide-react";
import { PageError } from "@/components/page-error";

export default function UsersError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} title="تعذّر تحميل المستخدمين" icon={<Users className="h-7 w-7" />} />;
}
