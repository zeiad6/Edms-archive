"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NAV_GROUPS } from "@/lib/navigation";
import { normalizeArabicTerm } from "@/lib/arabic";
import { cn } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

/**
 * Cmd/Ctrl-K command palette.
 *
 * Why this exists: the sidebar carries 20 destinations across 3 groups
 * (NAV_GROUPS). Once a navigation is that wide, a fourth level of nesting or
 * a hunt down the rail is the only way to reach anything, and the item you
 * want is never the one you can see.
 *
 * Keyboard contract (the part that decides whether a palette is usable or
 * merely decorative):
 *   - Cmd+K / Ctrl+K opens it from anywhere, including while a text field has
 *     focus. The shortcut wins over the field, otherwise the palette is
 *     unreachable from a form.
 *   - ArrowUp / ArrowDown move the active row, wrapping at both ends.
 *   - Enter navigates. Escape closes (Radix restores focus to the trigger).
 *
 * Arabic search: queries go through `normalizeArabicTerm` from
 * `src/lib/arabic.ts` — the same alef/teh-marbuta/hamza folding and light
 * stemming the document search uses — so "مستندات" matches "المستندات" and
 * "مستند". A raw `includes()` would miss all three.
 */

interface PaletteEntry {
  href: string;
  label: string;
  group: string;
  Icon: React.ComponentType<{ className?: string }>;
}

/**
 * Open request channel. The dialog and its trigger are separate components so
 * the trigger can live in the header while the dialog mounts once, near the
 * root of the shell. A window event keeps them decoupled without threading
 * state through the layout — and it means a future trigger (a mobile button,
 * a Spotlight row) is a one-line import rather than a prop drill.
 */
const OPEN_EVENT = "edms:open-command-palette";

export function openCommandPalette(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Pre-normalized haystacks, built once per open rather than per keystroke. */
function buildEntries(): PaletteEntry[] {
  return NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      href: item.href,
      label: item.label,
      group: group.label,
      Icon: item.icon,
    }))
  );
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  useLang(); // re-render the palette when the language toggles
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(() => buildEntries(), []);

  // Normalized index is stable for the lifetime of the component, so filtering
  // never re-normalizes 20 labels per keystroke.
  const index = useMemo(
    () =>
      entries.map((e) => ({
        entry: e,
        haystack: normalizeArabicTerm(e.label),
        path: normalizeArabicTerm(e.href),
      })),
    [entries]
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return index;
    // Every whitespace-separated token must match, so multi-word queries narrow
    // rather than widen — "سجل النشاط" should not also return "المستخدمون".
    const tokens = q
      .split(/\s+/)
      .map((tk) => normalizeArabicTerm(tk))
      .filter((tk) => tk.length > 0);
    if (tokens.length === 0) return index;
    return index.filter(({ haystack, path }) =>
      tokens.every((tk) => haystack.includes(tk) || path.includes(tk))
    );
  }, [index, query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      setActive(0);
      router.push(href);
    },
    [router]
  );

  // Global shortcut. Registered on window, not on the dialog, so it fires while
  // the user is typing into a form field elsewhere in the shell.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
      } else if (e.key === "Enter") {
        const target = results[active];
        if (target) {
          e.preventDefault();
          go(target.entry.href);
        }
      }
    };
    const onOpenRequest = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpenRequest);
    };
  }, [open, results, active, go]);

  // Keep the highlight inside the result window as the query narrows.
  useEffect(() => {
    setActive((i) => (i >= results.length ? 0 : i));
  }, [results.length]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActive(0);
          // Radix focuses the first focusable child on open; make it the input
          // so the user can type immediately.
          requestAnimationFrame(() => inputRef.current?.focus());
        }
      }}
    >
      <DialogContent
        className="surface-pop max-w-xl gap-0 overflow-hidden p-0"
        aria-label={t("لوحة الأوامر")}
      >
        <DialogTitle className="sr-only">{t("لوحة الأوامر")}</DialogTitle>

        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ابحث عن صفحة أو إجراء…")}
            aria-label={t("ابحث عن صفحة أو إجراء")}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="tnum hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[22rem] overflow-y-auto p-2" role="listbox" aria-label={t("النتائج")}>
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("لا توجد نتائج مطابقة")}
            </p>
          ) : (
            results.map(({ entry }, i) => {
              const isActive = i === active;
              const isCurrent = pathname === entry.href;
              return (
                <button
                  key={entry.href}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(entry.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors",
                    isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                  )}
                >
                  <entry.Icon
                    className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{t(entry.label)}</span>
                  {isCurrent ? (
                    <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {t("الحالية")}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-muted-foreground/70">{t(entry.group)}</span>
                  )}
                  {isActive && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="h-3 w-3" aria-hidden />
            <ArrowDown className="h-3 w-3" aria-hidden />
            {t("تنقّل")}
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" aria-hidden />
            {t("فتح")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Header affordance. The shortcut alone is not discoverable — a user who does
 * not already know about Cmd-K will never find the palette, so the header
 * carries a real button that advertises the key.
 */
export function CommandPaletteTrigger() {
  useLang(); // re-render when the language toggles
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label={t("لوحة الأوامر")}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Search className="h-4 w-4" aria-hidden />
      <kbd className="tnum hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold sm:block">
        Ctrl K
      </kbd>
    </button>
  );
}
