"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SearchHero } from "@/components/search/search-hero";
import { SearchResults } from "@/components/search/search-results";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { DestinationMatchBanner, isDestinationQuery } from "@/components/search/search-destinations";
import type { SearchResult, DeptOption, TagOption } from "@/components/search/search-types";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

export default function AdvancedSearchPage() {
  useLang(); // re-render on language toggle
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [operator, setOperator] = useState<"AND" | "OR">("AND");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);

  // Static options (loaded from server data via meta tags or inline data)
  // We'll load these from the server using a simple fetch
  const [docTypes] = useState([
    "عقد", "فاتورة", "تقرير", "خطاب", "كشف حساب", "شهادة", "مذكرة", "محضر", "صورة ضوئية", "أخرى",
  ]);
  const [statuses] = useState(["active", "pending_review", "archived", "draft"]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);

  // Ctrl+K / Ctrl+/ — focus search
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K" || e.key === "/") && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const toggleType = (t: string) =>
    setSelectedTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const toggleDept = (id: number) =>
    setSelectedDepts((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleTag = (id: number) =>
    setSelectedTags((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleStatus = (s: string) =>
    setSelectedStatuses((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const doSearch = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      setPage(pageNum);
      try {
        const res = await fetch("/api/search/advanced", {
          method: "POST",
          body: JSON.stringify({
            query,
            operator,
            docTypes: selectedTypes,
            departments: selectedDepts,
            tagIds: selectedTags,
            statuses: selectedStatuses,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            page: pageNum,
            pageSize: 50,
          }),
        });
        const data = await res.json();
        setResults(data.results || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
      } catch {
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    },
    [query, operator, selectedTypes, selectedDepts, selectedTags, selectedStatuses, dateFrom, dateTo]
  );

  // Debounced auto-search — when the user changes the query after the first search,
  // wait 600ms of inactivity then re-search
  useEffect(() => {
    if (!searched) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(1), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, operator, selectedTypes, selectedDepts, selectedTags, selectedStatuses, dateFrom, dateTo]);

  // Load options from the server
  useEffect(() => {
    fetch("/api/search/options")
      .then((r) => r.json())
      .then((data) => {
        setDepartments(data.departments || []);
        setTags(data.tags || []);
      })
      .catch(() => {});
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(1);
  }

  const hasFilters = Boolean(
    selectedTypes.length > 0 ||
      selectedDepts.length > 0 ||
      selectedTags.length > 0 ||
      selectedStatuses.length > 0 ||
      dateFrom ||
      dateTo
  );

  function clearAll() {
    setQuery("");
    setOperator("AND");
    setSelectedTypes([]);
    setSelectedDepts([]);
    setSelectedTags([]);
    setSelectedStatuses([]);
    setDateFrom("");
    setDateTo("");
    setResults([]);
    setSearched(false);
  }

  return (
    <div className="animate-fadein page-stack">
      {/* Hero search */}
      <SearchHero
        query={query}
        onQueryChange={setQuery}
        operator={operator}
        onOperatorChange={setOperator}
        loading={loading}
        onSubmit={handleSubmit}
        searchRef={searchRef}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((s) => !s)}
        hasFilters={hasFilters}
        onNavigate={(path) => router.push(path)}
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
        onToggleType={toggleType}
        onToggleDept={toggleDept}
        onToggleTag={toggleTag}
        onToggleStatus={toggleStatus}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClearAll={clearAll}
      />

      {/* Exact-match destination banner (search-as-navigation) */}
      {!loading && query.trim().length >= 2 && isDestinationQuery(query) && (
        <DestinationMatchBanner query={query} onNavigate={(path) => router.push(path)} />
      )}

      {/* Results */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-card px-6 py-20 shadow-card">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="skeleton-shimmer h-2 w-48 rounded-full" aria-hidden />
        </div>
      )}

      {!loading && searched && (
        <SearchResults
          results={results}
          total={total}
          page={page}
          totalPages={totalPages}
          query={query}
          onPageChange={doSearch}
        />
      )}

      {!loading && !searched && <SearchEmptyState onNavigate={(path) => router.push(path)} />}
    </div>
  );
}
