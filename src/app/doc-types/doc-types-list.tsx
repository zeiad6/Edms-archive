"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { InlineEditForm, DeleteDocTypeButton } from "./form";

interface DocTypeRow {
  id: number;
  name: string;
  nameEn: string | null;
  color: string;
  sortOrder: number;
  docCount: number;
}

export function DocTypesList({
  rows,
  isAdmin,
}: {
  rows: DocTypeRow[];
  isAdmin: boolean;
}) {
  useLang(); // re-render on language toggle
  const [q, setQ] = useState("");

  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.includes(q) ||
          (r.nameEn && r.nameEn.toLowerCase().includes(q.toLowerCase()))
      )
    : rows;

  return (
    <Card className="mt-5 overflow-hidden px-0 shadow-card">
      {/* Search header */}
      {rows.length > 3 && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("بحث في التصنيفات...")}
              className="h-10 w-full rounded-xl border border-border bg-muted ps-10 pe-9 text-sm text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label={t("مسح")}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="divide-y divide-border">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm transition hover:bg-muted/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="inline-block h-3.5 w-3.5 rounded-full shrink-0 shadow-sm ring-1 ring-inset ring-black/10"
                style={{ backgroundColor: r.color }}
              />
              <span className="truncate font-medium text-foreground">{r.name}</span>
              {r.nameEn && (
                <span className="truncate text-xs text-muted-foreground" dir="ltr">
                  {r.nameEn}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <span className="tnum text-xs text-muted-foreground">
                {t("{n} مستند", { n: r.docCount })}
              </span>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <InlineEditForm
                    id={r.id}
                    defaultName={r.name}
                    defaultNameEn={r.nameEn}
                    defaultColor={r.color}
                    defaultSortOrder={r.sortOrder}
                  />
                  <DeleteDocTypeButton name={r.name} />
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {q ? t("لا توجد نتائج مطابقة") : t("لا توجد تصنيفات بعد")}
          </p>
        )}
      </div>
    </Card>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card ${className}`}>
      {children}
    </div>
  );
}
