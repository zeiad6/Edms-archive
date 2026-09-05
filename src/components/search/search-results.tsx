import { SearchResultCard } from "./search-result-card";
import type { SearchResult } from "./search-types";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

interface SearchResultsProps {
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
  onPageChange: (page: number) => void;
}

export function SearchResults({ results, total, page, totalPages, query, onPageChange }: SearchResultsProps) {
  useLang(); // re-render on language toggle
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {total > 0 ? (
            <>{t("تم العثور على")}<span className="tnum font-bold text-foreground">{total}</span>{t("نتيجة")}</>
          ) : (
            t("لم يتم العثور على نتائج")
          )}
        </div>
        {total > 0 && (
          <span className="tnum text-xs text-muted-foreground">{t("الصفحة {p} من {t}", { p: page, t: totalPages })}</span>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-5 space-y-3.5">
          {results.map((doc) => (
            <SearchResultCard key={doc.id} doc={doc} query={query} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="h-10 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition-all duration-150 hover:bg-muted hover:border-primary/25 hover:shadow active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >{t("السابق")}</button>
          <span className="tnum rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="h-10 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition-all duration-150 hover:bg-muted hover:border-primary/25 hover:shadow active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >{t("التالي")}</button>
        </div>
      )}
    </>
  );
}
