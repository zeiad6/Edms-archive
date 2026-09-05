import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/format";
import { TYPE_TABS, READ_TABS } from "@/lib/notifications";
import { markAllNotificationsRead, deleteReadNotifications } from "@/actions/notifications";
import { NotificationList } from "@/components/notifications/notification-list";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function NotificationsPage(props: {
  searchParams?: Promise<{ type?: string; read?: string }>;
}) {
  const lang = await getServerLang();
  const searchParams = await props.searchParams;
  const typeFilter = searchParams?.type ?? "";
  const readFilter = searchParams?.read ?? "";

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  /* Build WHERE clause */
  const conds: ReturnType<typeof sql>[] = [sql`${notifications.userId} = ${user.id}`];
  if (typeFilter) conds.push(sql`${notifications.type} = ${typeFilter}`);
  if (readFilter === "unread") conds.push(sql`${notifications.readAt} IS NULL`);
  else if (readFilter === "read") conds.push(sql`${notifications.readAt} IS NOT NULL`);
  const whereClause = conds.length === 1 ? eq(notifications.userId, user.id) : and(...conds);

  // Unread count + list are independent — run them in one parallel batch
  // (was 2 sequential round-trips; now 1).
  const [[unreadRow], all] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), sql`${notifications.readAt} IS NULL`)),
    db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(100),
  ]);
  const unreadCount = unreadRow?.count ?? 0;

  return (
    <div className="animate-fadein page-stack">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="icon-tile h-12 w-12"><Bell className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h1 className="text-[1.65rem] font-extrabold leading-snug tracking-tight text-foreground">{ts(lang, "الإشعارات")}</h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {unreadCount > 0
              ? ts(lang, "لديك {n} إشعارات غير مقروءة", { n: unreadCount })
              : ts(lang, "جميع الإشعارات مقروءة")}
            </p>
          </div>
        </div>
        {all.length > 0 && unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition-all duration-150 hover:bg-muted hover:shadow active:scale-[0.98]"
            >
              <CheckCheck className="h-4 w-4" />{ts(lang, "تحديد الكل كمقروء")}</button>
          </form>
        )}
      </div>

      {/* Type filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {TYPE_TABS.map((tab) => {
          const active = typeFilter === tab.value;
          const href = tab.value
            ? `/notifications?type=${tab.value}${readFilter ? `&read=${readFilter}` : ""}`
            : `/notifications${readFilter ? `?read=${readFilter}` : ""}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={cn(
                "h-9 rounded-xl px-4 py-1.5 text-xs font-bold transition-all duration-150 active:scale-[0.97]",
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground hover:shadow",
              )}
            >
              {ts(lang, tab.label)}
            </Link>
          );
        })}
      </div>

      {/* Read/unread filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {READ_TABS.map((tab) => {
          const active = readFilter === tab.value;
          const href = tab.value
            ? `/notifications?read=${tab.value}${typeFilter ? `&type=${typeFilter}` : ""}`
            : `/notifications${typeFilter ? `?type=${typeFilter}` : ""}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={cn(
                "h-8 rounded-lg px-3.5 py-1 text-[11px] font-bold transition-all duration-150",
                active
                  ? "bg-muted-foreground/10 text-foreground shadow-sm ring-1 ring-inset ring-border"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {tab.value === "unread" && unreadCount > 0
                ? ts(lang, "{label} ({n})", { label: ts(lang, tab.label), n: unreadCount })
                : ts(lang, tab.label)}
            </Link>
          );
        })}
        <div className="ms-auto" />
        {all.length > 0 && (
          <form action={deleteReadNotifications}>
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-xs font-semibold text-red-600 shadow-sm transition-all duration-150 hover:bg-red-50 hover:shadow active:scale-[0.98] dark:text-red-400 dark:hover:bg-red-950/20"
            >
              <Trash2 className="h-3.5 w-3.5" />{ts(lang, "حذف المقروءة")}</button>
          </form>
        )}
      </div>

      {/* List / empty state */}
      <NotificationList items={all} typeFilter={typeFilter} />
    </div>
  );
}
