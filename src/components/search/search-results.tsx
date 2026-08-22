import { SearchResultCard } from "./search-result-card";
import type { SearchResult } from "./search-types";

interface SearchResultsProps {
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
  onPageChange: (page: number) => void;
}

export function SearchResults({ results, total, page, totalPages, query, onPageChange }: SearchResultsProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {total > 0 ? (
            <>تم العثور على <span className="font-bold text-foreground">{total}</span> نتيجة</>
          ) : (
            "لم يتم العثور على نتائج"
          )}
        </div>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">الصفحة {page} من {totalPages}</span>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-4 space-y-3">
          {results.map((doc) => (
            <SearchResultCard key={doc.id} doc={doc} query={query} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:bg-muted hover:border-primary/25 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >
            السابق
          </button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:bg-muted hover:border-primary/25 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >
            التالي
          </button>
        </div>
      )}
    </>
  );
}
