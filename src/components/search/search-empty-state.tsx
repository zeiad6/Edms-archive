"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Search } from "lucide-react";
import { SEARCH_DESTINATIONS } from "./search-destinations";

/**
 * Initial state of the search page — never blank:
 * quick navigation destinations act as search-as-navigation shortcuts.
 */
export function SearchEmptyState({ onNavigate }: { onNavigate: (path: string) => void }) {
  useLang(); // re-render on language toggle
  const quick = SEARCH_DESTINATIONS.slice(0, 9);
  return (
    <div className="flex flex-col items-center py-14 text-center sm:py-16">
      <div className="icon-tile mb-5 flex h-16 w-16 items-center justify-center !rounded-2xl">
        <Search className="h-7 w-7 text-primary/70" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{t("ابحث في الأرشيف")}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("ابحث عن مستند بالاسم أو الرقم أو المحتوى، أو انتقل مباشرة إلى إحدى الوجهات:")}</p>

      <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-3.5 sm:grid-cols-3">
        {quick.map((d) => {
          const Icon = d.icon;
          return (
            <button
              key={d.path}
              type="button"
              onClick={() => onNavigate(d.path)}
              className="card-interactive group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-start shadow-card hover:border-primary/40 hover:bg-primary/[0.04]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/15 transition-transform duration-200 group-hover:scale-105">
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
