"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Building2, Briefcase, FileText, CalendarDays, Users, User } from "lucide-react";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { ROLE_META, initials, formatDate, cn } from "@/lib/format";
import { UserActions } from "./user-actions";
import type { UserRow } from "./user-row";

export function UsersCards({
  rows,
  departments: depts,
  currentUserId,
}: {
  rows: UserRow[];
  departments: { id: number; name: string }[];
  currentUserId?: number;
}) {
  useLang(); // re-render on language toggle
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <EmptyState
          icon={Users}
          title={t("لا يوجد مستخدمون بعد")}
          description={t("عند إضافة أول مستخدم يظهر هنا ببطاقته الكاملة مع صلاحياته.")}
        />
      </Card>
    );
  }

  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
      {rows.map((u) => {
        const meta = ROLE_META[u.role];
        return (
          <Card key={u.id} interactive className="card-sheen flex flex-col gap-3.5 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ring-2 ring-white/60 dark:ring-white/10"
                  style={{ backgroundColor: u.avatarColor }}
                >
                  {initials(u.name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{u.name}</div>
                  <div className="truncate text-xs text-muted-foreground" dir="ltr">{u.email}</div>
                </div>
              </div>
              <UserActions user={u} departments={depts} currentUserId={currentUserId} />
            </div>

            <span
              className={cn(
                "inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ring-1 ring-inset ring-border/40",
                meta?.badge ?? "bg-muted text-muted-foreground"
              )}
            >
              {t(meta?.label ?? u.role)}
            </span>

            <div className="space-y-2 border-t border-border pt-3.5 text-sm">
              {u.jobTitle && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{u.jobTitle}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate" dir="ltr">{u.username}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{u.deptName ?? "—"}</span>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> {t("{n} مستند", { n: u.docs })}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {formatDate(u.joined)}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
