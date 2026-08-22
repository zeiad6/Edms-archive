"use client";

import { Filter } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { UserRow } from "@/lib/reports";
import { Section } from "./section";

interface UserSectionProps {
  users: UserRow[];
  search: string;
  onSearch: (v: string) => void;
}

/** User activity table (documents + size per user). */
export function UserSection({ users, search, onSearch }: UserSectionProps) {
  return (
    <Section
      title="نشاط المستخدمين"
      icon={<Filter className="h-4 w-4" />}
      search={search}
      onSearch={onSearch}
      placeholder="بحث في المستخدمين..."
    >
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-start">المستخدم</th>
              <th className="px-4 py-2.5 text-start">المستندات</th>
              <th className="px-4 py-2.5 text-start">الحجم</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((r) => (
              <tr key={r.userId} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: r.userColor ?? "#94a3b8" }}
                    />
                    {r.userName ?? "غير معروف"}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.count}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatBytes(r.size)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-xs text-muted-foreground">
                  لا توجد نتائج مطابقة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}