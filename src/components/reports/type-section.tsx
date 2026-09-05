"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Filter } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { TypeRow } from "@/lib/reports";
import { Section } from "./section";

interface TypeSectionProps {
  types: TypeRow[];
  search: string;
  onSearch: (v: string) => void;
}

/** Distribution of documents by type (table). */
export function TypeSection({ types, search, onSearch }: TypeSectionProps) {
  useLang(); // re-render on language toggle
  return (
    <Section
      title={t("توزيع المستندات حسب النوع")}
      icon={<Filter className="h-4 w-4" />}
      search={search}
      onSearch={onSearch}
      placeholder={t("بحث في الأنواع...")}
    >
      <div className="table-shell">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-start">{t("النوع")}</th>
              <th className="px-4 py-2.5 text-start">{t("العدد")}</th>
              <th className="px-4 py-2.5 text-start">{t("الحجم")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
              {types.map((r) => (
                <tr key={r.type} className="transition-colors hover:bg-primary/[0.04]">
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.type}</td>
                  <td className="px-4 py-2.5 tnum text-muted-foreground">{r.count}</td>
                  <td className="px-4 py-2.5 tnum text-muted-foreground">{formatBytes(r.size)}</td>
                </tr>
              ))}
            {types.length === 0 && (
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