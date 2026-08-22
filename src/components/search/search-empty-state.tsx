"use client";

import { Search } from "lucide-react";
import { SEARCH_DESTINATIONS } from "./search-destinations";

/**
 * Initial state of the search page — never blank:
 * quick navigation destinations act as search-as-navigation shortcuts.
 */
export function SearchEmptyState({ onNavigate }: { onNavigate: (path: string) => void }) {
  const quick = SEARCH_DESTINATIONS.slice(0, 9);
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 shadow-sm shadow-primary/10 ring-1 ring-inset ring-primary/20">
        <Search className="h-7 w-7 text-primary/70" />
      </div>
      <h3 className="text-base font-semibold text-foreground">ابحث في الأرشيف</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        ابحث عن مستند بالاسم أو الرقم أو المحتوى، أو انتقل مباشرة إلى إحدى الوجهات:
      </p>

      <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        {quick.map((d) => {
          const Icon = d.icon;
          return (
            <button
              key={d.path}
              type="button"
              onClick={() => onNavigate(d.path)}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-start shadow-sm shadow-slate-950/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-transform duration-200 group-hover:scale-105">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{d.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{d.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
