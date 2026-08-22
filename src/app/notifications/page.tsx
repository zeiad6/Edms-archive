import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server";
import { CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/format";
import { TYPE_TABS, READ_TABS } from "@/lib/notifications";
import { markAllNotificationsRead, deleteReadNotifications } from "@/actions/notifications";
import { NotificationList } from "@/components/notifications/notification-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage(props: {
  searchParams?: Promise<{ type?: string; read?: string }>;
}) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">الإشعارات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0
              ? `لديك ${unreadCount} إشعار${unreadCount === 1 ? "" : "ات"} غير مقروءة`
              : "جميع الإشعارات مقروءة"}
          </p>
        </div>
        {all.length > 0 && unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <CheckCheck className="h-4 w-4" />
              تحديد الكل كمقروء
            </button>
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
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {tab.label}
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
                "rounded-lg px-3 py-1 text-[11px] font-medium transition",
                active
                  ? "bg-muted-foreground/10 text-foreground ring-1 ring-inset ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.value === "unread" && unreadCount > 0
                ? `${tab.label} (${unreadCount})`
                : tab.label}
            </Link>
          );
        })}
        <div className="ms-auto" />
        {all.length > 0 && (
          <form action={deleteReadNotifications}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف المقروءة
            </button>
          </form>
        )}
      </div>

      {/* List / empty state */}
      <NotificationList items={all} typeFilter={typeFilter} />
    </div>
  );
}
