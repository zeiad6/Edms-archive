"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

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
  useLang(); // re-render on language toggle
  return (
    <Section
      title={t("نشاط المستخدمين")}
      icon={<Filter className="h-4 w-4" />}
      search={search}
      onSearch={onSearch}
      placeholder={t("بحث في المستخدمين...")}
    >
      <div className="table-shell">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-start">{t("المستخدم")}</th>
              <th className="px-4 py-2.5 text-start">{t("المستندات")}</th>
              <th className="px-4 py-2.5 text-start">{t("الحجم")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
              {users.map((r) => (
                <tr key={r.userId} className="transition-colors hover:bg-primary/[0.04]">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full shadow-sm"
                        style={{ backgroundColor: r.userColor ?? "#94a3b8" }}
                      />
                      {r.userName ?? t("غير معروف")}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tnum text-muted-foreground">{r.count}</td>
                  <td className="px-4 py-2.5 tnum text-muted-foreground">{formatBytes(r.size)}</td>
                </tr>
              ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-xs text-muted-foreground">{t("لا توجد نتائج مطابقة.")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}