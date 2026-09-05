import { Skeleton } from "@/components/ui/skeleton";
import { AppLogo } from "@/components/app-logo";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

/** Generic content skeleton shown while a route's server data resolves. */
export async function PageSkeleton() {
  const lang = await getServerLang();
  return (
    <div className="animate-fadein space-y-6" role="status" aria-label={ts(lang, "جارٍ تحميل الصفحة")}>
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="space-y-2.5">
          <Skeleton className="h-5 w-56 max-w-[50vw]" />
          <Skeleton className="h-3.5 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:gap-5 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <Skeleton className="h-[420px] rounded-3xl lg:col-span-2" />
        <Skeleton className="h-[420px] rounded-3xl" />
      </div>
    </div>
  );
}

export async function TableSkeleton() {
  const lang = await getServerLang();
  return (
    <div className="animate-fadein space-y-6" role="status" aria-label={ts(lang, "جارٍ تحميل الجدول")}>
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="space-y-2.5">
          <Skeleton className="h-5 w-56 max-w-[50vw]" />
          <Skeleton className="h-3.5 w-36" />
        </div>
      </div>
      <Skeleton className="h-[4.5rem] rounded-2xl" />
      <Skeleton className="h-[520px] rounded-3xl" />
    </div>
  );
}

/** Skeleton mirroring the dashboard layout (hero + KPIs + cards + charts). */
export async function DashboardSkeleton() {
  const lang = await getServerLang();
  return (
    <div className="animate-fadein space-y-6" role="status" aria-label={ts(lang, "جارٍ تحميل لوحة التحكم")}>
      {/* Hero */}
      <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-6 shadow-card sm:p-8">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <div className="mt-5 flex gap-2.5">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="hidden h-10 w-32 rounded-xl sm:block" />
        </div>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-5 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      {/* Recent + activity */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <Skeleton className="h-[340px] rounded-3xl lg:col-span-2" />
        <Skeleton className="h-[340px] rounded-3xl" />
      </div>
      {/* Distribution */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <Skeleton className="h-[240px] rounded-3xl lg:col-span-2" />
        <Skeleton className="h-[240px] rounded-3xl" />
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        <Skeleton className="h-[240px] rounded-3xl md:col-span-2 lg:col-span-1" />
        <Skeleton className="h-[240px] rounded-3xl" />
        <Skeleton className="h-[240px] rounded-3xl" />
      </div>
    </div>
  );
}

/**
 * First-boot / desktop splash — same brand as the Electron window background
 * (#f2f5fa light) so the frameless window never flashes blank. Shown while
 * the Next server boots; replaced by real content on first paint.
 */
export async function BootSplash() {
  const lang = await getServerLang();
  return (
    <div
      role="status"
      aria-label={ts(lang, "جارٍ تشغيل نظام الأرشفة")}
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-card px-6 py-16 text-center shadow-card"
    >
      <span className="relative flex">
        <AppLogo size={64} className="rounded-2xl shadow-lg shadow-primary/25" />
        <span aria-hidden className="absolute -inset-2 -z-10 animate-ping rounded-3xl bg-primary/10" />
      </span>
      <div>
        <p className="text-lg font-extrabold text-foreground">{ts(lang, "أرشيف — نظام الأرشفة الإلكتروني")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{ts(lang, "جارٍ تجهيز قاعدة البيانات المحلية...")}</p>
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span aria-hidden className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span aria-hidden className="h-2 w-2 animate-bounce rounded-full bg-primary" />
      </div>
      <div className="skeleton-shimmer h-2 w-48 rounded-full" />
    </div>
  );
}
