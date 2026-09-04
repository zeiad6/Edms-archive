import { Skeleton } from "@/components/ui/skeleton";
import { AppLogo } from "@/components/app-logo";

/** Generic content skeleton shown while a route's server data resolves. */
export function PageSkeleton() {
  return (
    <div className="animate-fadein space-y-5" role="status" aria-label="جارٍ تحميل الصفحة">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-[420px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="animate-fadein space-y-5" role="status" aria-label="جارٍ تحميل الجدول">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-[520px] rounded-2xl" />
    </div>
  );
}

/** Skeleton mirroring the dashboard layout (hero + KPIs + cards + charts). */
export function DashboardSkeleton() {
  return (
    <div className="animate-fadein space-y-5" role="status" aria-label="جارٍ تحميل لوحة التحكم">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-6 shadow-sm">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      {/* Recent + activity */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[340px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[340px] rounded-2xl" />
      </div>
      {/* Distribution */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[240px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[240px] rounded-2xl" />
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[240px] rounded-2xl md:col-span-2 lg:col-span-1" />
        <Skeleton className="h-[240px] rounded-2xl" />
        <Skeleton className="h-[240px] rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * First-boot / desktop splash — same brand as the Electron window background
 * (#f2f5fa light) so the frameless window never flashes blank. Shown while
 * the Next server boots; replaced by real content on first paint.
 */
export function BootSplash() {
  return (
    <div
      role="status"
      aria-label="جارٍ تشغيل نظام الأرشفة"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-card px-6 py-16 text-center shadow-card"
    >
      <span className="relative flex">
        <AppLogo size={64} className="rounded-2xl shadow-lg shadow-primary/25" />
        <span aria-hidden className="absolute -inset-2 -z-10 animate-ping rounded-3xl bg-primary/10" />
      </span>
      <div>
        <p className="text-lg font-extrabold text-foreground">أرشيف — نظام الأرشفة الإلكتروني</p>
        <p className="mt-1 text-sm text-muted-foreground">جارٍ تجهيز قاعدة البيانات المحلية...</p>
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
