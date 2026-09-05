import Link from "next/link";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export async function AccessDenied() {
  const lang = await getServerLang();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-bold text-foreground">{ts(lang, "لا تملك صلاحية الوصول")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{ts(lang, "هذا المستند مقيد أو سري ولا يحق لمستخدمك الحالي عرضه.")}</p>
      <Link
        href="/documents"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <ArrowRight className="h-4 w-4" />{ts(lang, "العودة للمستندات")}</Link>
    </div>
  );
}
