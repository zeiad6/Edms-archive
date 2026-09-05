import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { Button } from "@/components/ui/button";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export default async function NotFound() {
  const lang = await getServerLang();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <AppLogo size={64} className="mb-4 rounded-2xl shadow-lg shadow-indigo-500/20" />
      <h2 className="text-3xl font-black text-foreground">404</h2>
      <p className="mt-1 text-sm text-muted-foreground">{ts(lang, "الصفحة أو المستند الذي تبحث عنه غير موجود.")}</p>
      <Button asChild className="mt-5">
        <Link href="/">{ts(lang, "العودة للوحة المعلومات")}</Link>
      </Button>
    </div>
  );
}
