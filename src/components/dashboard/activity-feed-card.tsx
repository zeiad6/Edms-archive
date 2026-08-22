import Link from "next/link";
import { Download, Eye, FileUp, History, LogIn, Pencil, ScanLine as ScanIcon, Search, Settings, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { cn, timeAgo } from "@/lib/format";
import type { AuditLog } from "@/db/schema";

const AUDIT_META: Record<string, { label: string; icon: typeof Eye; tone: string }> = {
  "document.upload": { label: "إيداع مستند", icon: FileUp, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  "document.scan": { label: "مسح ضوئي", icon: ScanIcon, tone: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
  "document.view": { label: "عرض مستند", icon: Eye, tone: "text-slate-600 dark:text-slate-300 bg-slate-500/10" },
  "document.download": { label: "تنزيل مستند", icon: Download, tone: "text-sky-600 dark:text-sky-400 bg-sky-500/10" },
  "document.search": { label: "بحث في الأرشيف", icon: Search, tone: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10" },
  "document.update": { label: "تحديث بيانات", icon: Pencil, tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  "document.delete": { label: "حذف مستند", icon: Trash2, tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
  "auth.login": { label: "تسجيل الدخول", icon: LogIn, tone: "text-slate-600 dark:text-slate-300 bg-slate-500/10" },
  "department.create": { label: "إنشاء قسم", icon: Settings, tone: "text-teal-600 dark:text-teal-400 bg-teal-500/10" },
  "folder.create": { label: "إنشاء مجلد", icon: Settings, tone: "text-teal-600 dark:text-teal-400 bg-teal-500/10" },
  "user.create": { label: "إضافة مستخدم", icon: Settings, tone: "text-teal-600 dark:text-teal-400 bg-teal-500/10" },
};

interface ActivityFeedCardProps {
  activity: AuditLog[];
}

/**
 * Latest audit activity timeline.
 */
export function ActivityFeedCard({ activity }: ActivityFeedCardProps) {
  return (
    <Card className="flex flex-col lg:col-span-1">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-bold text-foreground">آخر النشاطات</h3>
        <Link href="/audit" className="text-xs font-semibold text-primary transition-colors duration-150 hover:text-primary/80">السجل</Link>
      </div>
      <div className="flex-1 p-5">
        {activity.length === 0 ? (
          <EmptyState
            compact
            icon={History}
            title="لا نشاطات بعد"
            description="سجّل النظام هنا عمليات الإيداع والبحث والتحميل تلقائياً."
            action={{ label: "عرض السجل الكامل", href: "/audit" }}
          />
        ) : (
          <div>
            {activity.map((a, i) => {
              const meta = AUDIT_META[a.action] ?? { label: a.action, icon: Settings, tone: "text-slate-600 dark:text-slate-300 bg-slate-500/10" };
              const Icon = meta.icon;
              return (
                <div key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card", meta.tone)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    {i < activity.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className={cn("min-w-0 flex-1", i < activity.length - 1 && "pb-4")}>
                    <div className="text-sm text-foreground">
                      <span className="font-semibold">{a.userName ?? "النظام"}</span>
                      <span className="text-muted-foreground"> · {meta.label}</span>
                    </div>
                    {a.details && <div className="truncate text-xs text-muted-foreground">{a.details}</div>}
                    <div className="mt-0.5 text-[11px] text-muted-foreground/70">{timeAgo(a.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
