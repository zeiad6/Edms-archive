"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Fuse from "fuse.js";
import { Search, CornerDownLeft, FileText, ChevronUp, ChevronDown } from "lucide-react";
import { STATUS_META, cn } from "@/lib/format";
import { normalizeArabic } from "@/lib/arabic";
import { t } from "@/lib/i18n";

export interface SearchItem {
  id: number;
  title: string;
  docNumber: string;
  docType: string;
  status: string;
  departmentName: string;
  departmentColor: string;
}

/**
 * Smart global search: Fuse.js ranks results by fuzzy match score, Mark.js
 * highlights the typed keywords live inside the dropdown. Keyboard friendly
 * (↑/↓ to move, Enter to open the active result, Esc to close). Pressing Enter
 * with no active result falls back to the full server-side content search.
 */
export function SearchBox({ index }: { index: SearchItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [fuse, setFuse] = useState<Fuse<SearchItem> | null>(null);

  // Fuse.js is loaded on demand (post-hydration) into its own chunk so it never
  // weighs down the initial bundle of every page that renders the shell.
  useEffect(() => {
    let active = true;
    import("fuse.js").then(({ default: FuseCtor }) => {
      if (!active) return;
      setFuse(
        new FuseCtor<SearchItem>(index, {
          keys: [
            { name: "title", weight: 0.6 },
            { name: "docNumber", weight: 0.25 },
            { name: "docType", weight: 0.1 },
            { name: "departmentName", weight: 0.05 },
          ],
          // Normalize Arabic (alef variants, teh marbuta, tashkeel) at match
          // time so "إلى" matches "الى" and "مؤسسة" matches "موسسه".
          getFn: (item, path) => {
            const keys = Array.isArray(path) ? path : [path];
            const value = keys.reduce((acc: any, key: string) => acc?.[key], item);
            return value == null ? "" : normalizeArabic(String(value));
          },
          includeScore: true,
          threshold: 0.45,
          ignoreLocation: true,
          minMatchCharLength: 1,
        })
      );
    });
    return () => {
      active = false;
    };
  }, [index]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q || !fuse) return [] as Array<{ item: SearchItem; score?: number }>;
    return fuse.search(normalizeArabic(q)).slice(0, 8);
  }, [query, fuse]);

  // Highlight matches with Mark.js (loaded on the client only) after each render.
  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const q = query.trim();
    let cancelled = false;
    (async () => {
      const Mark = (await import("mark.js")).default as any;
      if (cancelled || !listRef.current) return;
      const instance = new Mark(listRef.current);
      instance.unmark();
      if (q) instance.mark(q, { accuracy: "partially", separateWordSearch: true, diacritics: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [query, results, open]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(id: number) {
    setOpen(false);
    setQuery("");
    router.push(`/documents/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const q = query.trim();
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && results[active]) go(results[active].item.id);
      else if (q) router.push(`/documents?q=${encodeURIComponent(q)}`);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
  }

  const q = query.trim();
  const show = open && q.length > 0;

  return (
    <div ref={boxRef} className="relative max-w-xl flex-1">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        type="search"
        role="combobox"
        aria-expanded={show}
        aria-controls="search-dropdown"
        placeholder={t("ابحث عن أي مستند أو رقم أو قسم... (بحث ذكي مرن)")}
        spellCheck
        lang="ar"
        className="w-full rounded-xl border border-border bg-muted py-2.5 ps-10 pe-4 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
      />

      {show && (
        <div
          id="search-dropdown"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/10"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              لا توجد نتائج مطابقة لـ «<span className="font-semibold text-foreground">{q}</span>»
              <div className="mt-2">
                <button
                  onClick={() => router.push(`/documents?q=${encodeURIComponent(q)}`)}
                  className="text-xs font-semibold text-primary hover:opacity-80"
                >
                  جرّب البحث الكامل في المحتوى (OCR) ↗
                </button>
              </div>
            </div>
          ) : (
            <>
              <div ref={listRef} key={q} className="max-h-[360px] overflow-y-auto py-1.5">
                {results.map((r, i) => {
                  const st = STATUS_META[r.item.status] ?? STATUS_META.active;
                  return (
                    <button
                      key={r.item.id}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r.item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-start transition",
                        active === i ? "bg-accent" : "hover:bg-muted"
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{r.item.title}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {r.item.docNumber && <span className="font-mono">{r.item.docNumber}</span>}
                          {r.item.docType && <span>· {r.item.docType}</span>}
                          {r.item.departmentName && (
                            <span className="inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: r.item.departmentColor }} />
                              {r.item.departmentName}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className={cn("hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex", st.badge)}>
                        {st.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded bg-card px-1.5 py-0.5 ring-1 ring-border"><ChevronUp className="inline h-3 w-3" /><ChevronDown className="inline h-3 w-3" /></kbd>
                  للتنقل
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded bg-card px-1.5 py-0.5 ring-1 ring-border"><CornerDownLeft className="inline h-3 w-3" /></kbd>
                  فتح / بحث كامل في المحتوى
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
