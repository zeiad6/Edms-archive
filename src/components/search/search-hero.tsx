import { Search, Loader2, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/format";
import { SearchFilters } from "./search-filters";
import type { SearchFiltersProps } from "./search-filters";
import { SearchDestinations } from "./search-destinations";
import type { DeptOption, TagOption } from "./search-types";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

export interface SearchHeroProps extends SearchFiltersProps {
  query: string;
  onQueryChange: (v: string) => void;
  operator: "AND" | "OR";
  onOperatorChange: (v: "AND" | "OR") => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasFilters: boolean;
  onNavigate: (path: string) => void;
}

export function SearchHero({
  query,
  onQueryChange,
  operator,
  onOperatorChange,
  loading,
  onSubmit,
  searchRef,
  showFilters,
  onToggleFilters,
  hasFilters,
  onNavigate,
  docTypes,
  departments,
  tags,
  statuses,
  selectedTypes,
  selectedDepts,
  selectedTags,
  selectedStatuses,
  dateFrom,
  dateTo,
  onToggleType,
  onToggleDept,
  onToggleTag,
  onToggleStatus,
  onDateFromChange,
  onDateToChange,
  onClearAll,
}: SearchHeroProps) {
  const filterCount = selectedTypes.length + selectedDepts.length + selectedTags.length + selectedStatuses.length;
  useLang(); // re-render when the language toggles

  return (
    <div className="card-sheen relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/40 p-6 shadow-card ring-1 ring-inset ring-primary/10 sm:p-7">
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-primary/[0.08] blur-3xl" />
      <h1 className="relative text-[1.65rem] font-extrabold tracking-tight text-foreground">{t("بحث متقدم في الأرشيف")}</h1>
      <p className="relative mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{t("استخدم البـحـث الـثـنـائـي AND/OR واستبعاد الكلمات بـ - واستخدم الفلاتر المتقدمة للبحث الدقيق")}</p>

      <form onSubmit={onSubmit} className="relative mt-6 space-y-4">
        {/* Search row */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t("ابحث عن مستند، وثيقة، قسم، أو صفحة…")}
              spellCheck
              lang="ar"
              autoFocus
              className="h-12 w-full rounded-2xl border border-border bg-card ps-12 pe-10 text-sm text-foreground shadow-sm outline-none transition-all duration-150 hover:border-primary/30 hover:shadow focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            {query && (
              <button
                type="button"
                aria-label={t("مسح البحث")}
                onClick={() => onQueryChange("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <SearchDestinations query={query} onNavigate={onNavigate} searchRef={searchRef} />
          </div>
          <select
            value={operator}
            onChange={(e) => onOperatorChange(e.target.value as "AND" | "OR")}
            className="h-12 rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm outline-none transition-all duration-150 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          >
            <option value="AND">{t("AND (كل الكلمات)")}</option>
            <option value="OR">{t("OR (أي كلمة)")}</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-7 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-150 hover:-translate-y-px hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-60 disabled:shadow-none"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t("بحث")}
          </button>
          <button
            type="button"
            onClick={onToggleFilters}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-2xl border px-5 text-sm font-semibold shadow-sm transition-all duration-150 hover:shadow active:scale-[0.98]",
              showFilters || hasFilters
                ? "border-primary/50 bg-primary/10 text-primary shadow-primary/10"
                : "border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t("فلترة")}
            {hasFilters && <span className="ms-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-primary/30">{filterCount}</span>}
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <SearchFilters
            docTypes={docTypes}
            departments={departments}
            tags={tags}
            statuses={statuses}
            selectedTypes={selectedTypes}
            selectedDepts={selectedDepts}
            selectedTags={selectedTags}
            selectedStatuses={selectedStatuses}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onToggleType={onToggleType}
            onToggleDept={onToggleDept}
            onToggleTag={onToggleTag}
            onToggleStatus={onToggleStatus}
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
            onClearAll={onClearAll}
          />
        )}
      </form>
    </div>
  );
}
