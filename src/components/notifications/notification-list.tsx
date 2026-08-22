import Link from "next/link";
import { CheckCheck, Eye, FileText, Bell } from "lucide-react";
import { cn } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import type { Notification } from "@/db/schema";
import { NOTIFICATION_LABELS } from "@/lib/notifications";
import { markNotificationRead } from "@/actions/notifications";

export function NotificationList({
  items,
  typeFilter,
}: {
  items: Notification[];
  typeFilter: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={typeFilter ? Eye : Bell}
        title={typeFilter ? "لا توجد إشعارات من هذا النوع" : "لا توجد إشعارات"}
        description={typeFilter ? undefined : "عندما يصلك إشعار، سيظهر هنا"}
        action={typeFilter ? { label: "عرض الكل", href: "/notifications" } : undefined}
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((n) => (
        <div
          key={n.id}
          className={cn(
            "group flex items-start gap-4 rounded-xl border border-border p-4 transition hover:bg-muted/50",
            !n.readAt && "border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20",
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              n.type === "approval_approved"
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                : n.type === "approval_rejected"
                  ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                  : "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
            )}
          >
            {n.type === "approval_approved" ? (
              <CheckCheck className="h-5 w-5" />
            ) : n.type === "approval_rejected" ? (
              <Eye className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                  n.type === "approval_approved"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : n.type === "approval_rejected"
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                )}
              >
                {NOTIFICATION_LABELS[n.type] ?? n.type}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(n.createdAt).toLocaleDateString("ar-SA", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {!n.readAt && (
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{n.title}</p>
            <p className="text-sm text-muted-foreground">{n.message}</p>

            {/* Actions */}
            <div className="mt-2 flex items-center gap-3">
              {n.documentId && (
                <Link
                  href={`/documents/${n.documentId}`}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  عرض المستند ←
                </Link>
              )}
              {!n.readAt && (
                <form action={markNotificationRead}>
                  <input type="hidden" name="notificationId" value={n.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    تحديد كمقروء
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
