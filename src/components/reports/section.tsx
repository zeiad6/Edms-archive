"use client";

import { Search, X } from "lucide-react";

export const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "#94a3b8" },
  pending_review: { label: "قيد المراجعة", color: "#f59e0b" },
  active: { label: "نشط", color: "#22c55e" },
  archived: { label: "مؤرشف", color: "#6366f1" },
};

export const MONTH_LABELS: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "إبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  search?: string;
  onSearch?: (v: string) => void;
  placeholder?: string;
  hasSearch?: boolean;
}

/** Card wrapper with optional search box — shared by all report sections. */
export function Section({
  title,
  icon,
  children,
  search,
  onSearch,
  placeholder,
  hasSearch = true,
}: SectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">{icon} {title}</h3>
        {hasSearch && onSearch && (
          <div className="relative min-w-[180px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={placeholder ?? "بحث..."}
              className="w-full rounded-lg border border-border bg-muted py-1.5 ps-8 pe-7 text-xs text-foreground outline-none transition focus:border-ring focus:bg-card"
            />
            {search && (
              <button
                onClick={() => onSearch("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}