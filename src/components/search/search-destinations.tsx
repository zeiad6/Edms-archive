"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Upload, ScanLine, CheckCircle2, BarChart3, PieChart,
  Users, Building2, FolderOpen, Tag, FileType2, LayoutTemplate,
  Trash2, History, Bell, ShieldCheck, Settings, CornerDownLeft, X, Flame,
} from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Search-as-navigation: system pages surfaced as destinations.
 * Users type "المستخدمين" or "settings" and jump straight to the page.
 */

export interface SearchDestination {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  /** Frequently visited destination — ranked first on score ties, flagged with a flame icon. */
  popular?: boolean;
}

export const SEARCH_DESTINATIONS: SearchDestination[] = [
  { path: "/documents", title: "المستندات", description: "أرشيف الوثائق", keywords: ["وثائق", "أرشيف", "مستند", "docs", "documents", "files", "archive"], icon: FileText, popular: true },
  { path: "/upload", title: "رفع مستند", description: "إيداع ملف جديد", keywords: ["رفع", "إيداع", "upload", "add"], icon: Upload, popular: true },
  { path: "/scan", title: "مسح ضوئي", description: "ماسح المستندات OCR", keywords: ["مسح", "ماسح", "scan", "scanner", "ocr"], icon: ScanLine },
  { path: "/approvals", title: "الموافقات", description: "سير عمل الاعتماد", keywords: ["اعتماد", "موافقة", "موافقات", "approval", "approvals", "workflow"], icon: CheckCircle2, popular: true },
  { path: "/reports", title: "التقارير", description: "تقارير وإحصاءات", keywords: ["تقرير", "تقارير", "إحصائيات", "reports", "statistics"], icon: BarChart3 },
  { path: "/analytics", title: "التحليلات", description: "لوحة التحليلات", keywords: ["تحليل", "تحليلات", "لوحة", "analytics", "dashboard", "charts"], icon: PieChart },
  { path: "/users", title: "المستخدمون", description: "إدارة الحسابات", keywords: ["مستخدم", "مستخدمون", "موظف", "موظفين", "حساب", "users", "people", "accounts"], icon: Users },
  { path: "/departments", title: "الأقسام", description: "الإدارات والوحدات", keywords: ["قسم", "أقسام", "إدارة", "إدارات", "departments"], icon: Building2 },
  { path: "/folders", title: "المجلدات", description: "تنظيم المستندات", keywords: ["مجلد", "مجلدات", "folders"], icon: FolderOpen },
  { path: "/tags", title: "الوسوم", description: "وسوم التصنيف", keywords: ["وسم", "وسوم", "tags"], icon: Tag },
  { path: "/doc-types", title: "التصنيفات", description: "أنواع المستندات", keywords: ["تصنيف", "تصنيفات", "أنواع", "doc-types", "doc types", "types"], icon: FileType2 },
  { path: "/templates", title: "القوالب", description: "قوالب المستندات", keywords: ["قالب", "قوالب", "نموذج", "نماذج", "templates"], icon: LayoutTemplate },
  { path: "/trash", title: "سلة المحذوفات", description: "المستندات المحذوفة", keywords: ["حذف", "محذوف", "محذوفات", "سلة", "trash", "deleted", "recycle"], icon: Trash2, popular: true },
  { path: "/audit", title: "سجل النشاط", description: "سجل التدقيق", keywords: ["تدقيق", "سجل", "نشاط", "audit", "log", "history"], icon: History },
  { path: "/notifications", title: "الإشعارات", description: "التنبيهات", keywords: ["إشعار", "إشعارات", "تنبيه", "تنبيهات", "notifications", "alerts"], icon: Bell },
  { path: "/permissions", title: "الصلاحيات", description: "إدارة RBAC", keywords: ["صلاحية", "صلاحيات", "أدوار", "permissions", "roles", "rbac"], icon: ShieldCheck },
  { path: "/settings", title: "الإعدادات", description: "إعدادات النظام", keywords: ["إعداد", "إعدادات", "ضبط", "settings", "preferences", "config"], icon: Settings, popular: true },
];

/** Normalize Arabic + Latin text for forgiving matching (harakat, hamza, taa marbuta). */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "") // diacritics + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rank destinations for a query: exact > prefix > substring, popular first on ties. */
export function matchDestinations(query: string, limit = 6): SearchDestination[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored: { d: SearchDestination; score: number }[] = [];
  for (const d of SEARCH_DESTINATIONS) {
    const title = normalize(d.title);
    const haystacks = [title, ...d.keywords.map(normalize)];
    for (const h of haystacks) {
      if (h === q) { scored.push({ d, score: 100 }); break; }
      if (h.startsWith(q)) { scored.push({ d, score: 70 }); break; }
      // Both directions: query ⊇ keyword ("المستخدمين" → "مستخدم") and keyword ⊇ query
      if (h.includes(q) || q.includes(h)) { scored.push({ d, score: 40 }); break; }
    }
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.d.popular ?? false) - Number(a.d.popular ?? false) ||
        a.d.title.localeCompare(b.d.title, "ar")
    )
    .slice(0, limit)
    .map((s) => s.d);
}

/** True when the query uniquely resolves to one destination (exact title match). */
export function isDestinationQuery(query: string): boolean {
  const q = normalize(query);
  return SEARCH_DESTINATIONS.some(
    (d) => normalize(d.title) === q || d.keywords.some((k) => normalize(k) === q)
  );
}

export interface MatchRange {
  start: number;
  end: number;
}

/**
 * Locate the normalized query inside the ORIGINAL (unnormalized) text.
 * Offsets are mapped back to the original string, so the returned slice
 * preserves the user-visible spelling while matching was done loosely
 * (hamza/taa-marbuta/diacritics tolerant). Falls back to the longest
 * matching prefix when the full query does not appear verbatim.
 */
export function findMatchRange(text: string, query: string): MatchRange | null {
  const q = normalize(query);
  if (!q) return null;
  const t = normalize(text);
  let idx = -1;
  let len = 0;
  for (let l = q.length; l >= 2; l--) {
    const hit = t.indexOf(q.slice(0, l));
    if (hit !== -1) { idx = hit; len = l; break; }
  }
  if (idx === -1) return null;

  // Reconstruct the normalization mapping: for every normalized character,
  // record the original index it came from. Whitespace runs collapse to a
  // single space, leading/trailing whitespace is trimmed, and dropped
  // characters (diacritics/tatweel) contribute nothing — matching the exact
  // semantics of normalize() applied to the whole string.
  const origIdx: number[] = [];
  let pendingWs = false; // whitespace run in progress
  let seenChar = false;  // any non-whitespace character yet (leading trim)
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) {
      // First space of an internal run maps to itself; later ones collapse.
      if (seenChar && !pendingWs) { origIdx.push(i); pendingWs = true; }
      continue;
    }
    pendingWs = false;
    if (normalize(c).length === 0) continue; // diacritics/tatweel dropped
    seenChar = true;
    origIdx.push(i);
  }
  // normalize() trims trailing whitespace — drop any trailing mapped spaces.
  while (origIdx.length > 0 && /\s/.test(text[origIdx[origIdx.length - 1]])) origIdx.pop();

  if (idx + len > origIdx.length) return null;
  const start = origIdx[idx] ?? 0;
  const last = origIdx[idx + len - 1];
  return { start, end: last === undefined ? text.length : last + 1 };
}

/** Render `text` with the query-matched portion wrapped in `<mark>`. */
export function highlightMatch(text: string, query: string): React.ReactNode {
  const range = findMatchRange(text, query);
  if (!range) return text;
  return (
    <>
      {text.slice(0, range.start)}
      <mark className="rounded-[3px] bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-500/30">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </>
  );
}

export interface SearchDestinationsProps {
  query: string;
  onNavigate: (path: string) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

/** Dropdown listing destinations matching the current query. */
export function SearchDestinations({ query, onNavigate, searchRef, className }: SearchDestinationsProps) {
  useLang(); // re-render on language toggle
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const matches = useMemo(() => matchDestinations(query, 6), [query]);

  // Show after 2 chars; close when query empties
  useEffect(() => {
    setOpen(query.trim().length >= 2);
    setActiveIdx(0);
  }, [query]);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      onNavigate(path);
      router.push(path);
    },
    [onNavigate, router]
  );

  /** Keyboard navigation: ArrowDown/ArrowUp move between items, Escape returns to input. */
  const handleItemKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("button[role=option]");
    if (!buttons) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? Math.min(idx + 1, buttons.length - 1) : Math.max(idx - 1, 0);
      buttons[next]?.focus();
      setActiveIdx(next);
    } else if (e.key === "Escape") {
      e.preventDefault();
      searchRef?.current?.focus();
    } else if (e.key === "Enter") {
      navigate(matches[idx]?.path ?? "");
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && open && matches.length > 0) {
      e.preventDefault();
      const first = listRef.current?.querySelector<HTMLButtonElement>("button[role=option]");
      first?.focus();
      setActiveIdx(0);
    }
  };

  if (!open || matches.length === 0) return null;

  return (
    <div
      ref={listRef}
      onKeyDown={handleInputKeyDown}
      className={cn("animate-fadein absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-pop surface-pop", className)}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">{t("الوجهات")}</span>
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary ring-1 ring-inset ring-primary/15">{matches.length}</span>
      </div>
      <ul role="listbox" aria-label={t("الوجهات المقترحة")}>
        {matches.map((d, i) => {
          const Icon = d.icon;
          return (
            <li key={d.path}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => navigate(d.path)}
                onKeyDown={(e) => handleItemKeyDown(e, i)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors duration-150 active:bg-primary/10",
                  i === activeIdx ? "bg-primary/15 text-foreground" : "text-foreground hover:bg-muted/70"
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{highlightMatch(t(d.title), query)}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {d.popular && <Flame className="h-3 w-3 shrink-0 text-amber-500" aria-label={t("شائعة")} />}
                    <span className="min-w-0 flex-1 truncate">{t(d.description)}</span>
                    <span dir="ltr" className="shrink-0 font-medium text-muted-foreground/60">{d.path}</span>
                  </span>
                </span>
                <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground/50" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Small pill showing that the current query resolves to a page. */
export function DestinationMatchBanner({ query, onNavigate }: { query: string; onNavigate: (p: string) => void }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  // Re-show the banner whenever the query changes (after a manual dismiss).
  useEffect(() => {
    setDismissed(false);
  }, [query]);

  const dest = useMemo(
    () =>
      SEARCH_DESTINATIONS.find(
        (d) => normalize(d.title) === normalize(query) || d.keywords.some((k) => normalize(k) === normalize(query))
      ),
    [query]
  );
  if (!dest || dismissed) return null;
  const Icon = dest.icon;
  return (
    <div className="animate-fadein relative inline-flex w-full items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3.5 text-start shadow-card">
      <button
        type="button"
        onClick={() => {
          onNavigate(dest.path);
          router.push(dest.path);
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-start transition hover:opacity-90"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-primary">{t("فتح صفحة")} {highlightMatch(t(dest.title), query)}</span>
          <span dir="ltr" className="block truncate text-xs text-muted-foreground">{dest.path}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label={t("إخفاء الاقتراح")}
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition hover:bg-primary/10 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
