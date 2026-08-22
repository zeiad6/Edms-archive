"use client";

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
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <EmptyState
          icon={Users}
          title="لا يوجد مستخدمون بعد"
          description="عند إضافة أول مستخدم يظهر هنا ببطاقته الكاملة مع صلاحياته."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((u) => {
        const meta = ROLE_META[u.role];
        return (
          <Card key={u.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
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
                "inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                meta?.badge ?? "bg-muted text-muted-foreground"
              )}
            >
              {meta?.label ?? u.role}
            </span>

            <div className="space-y-1.5 border-t border-border pt-3 text-sm">
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

            <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> {u.docs} مستند
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
