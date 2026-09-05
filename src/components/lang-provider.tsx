"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { setLang as setModuleLang, type Lang } from "@/lib/i18n";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "ar",
  setLang: () => {},
});

/**
 * Applies a language to the document root (html lang/dir) AND the i18n module
 * variable. `dir` flips the whole layout (rtl ↔ ltr).
 */
function applyLang(l: Lang) {
  setModuleLang(l);
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  // Mirror to a cookie so server components render the same language
  // (read via getServerLang) and the next full load is SSR-correct.
  try {
    document.cookie = `lang=${l}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  // On mount: hydrate from localStorage (default "ar"). The pre-paint script
  // in layout.tsx already fixed the document root before first paint; here we
  // just sync React state and the module variable.
  useEffect(() => {
    let stored: Lang = "ar";
    try {
      const v = localStorage.getItem("lang");
      if (v === "en" || v === "ar") stored = v;
    } catch {
      /* ignore */
    }
    applyLang(stored);
    setLangState(stored);
  }, []);

  const setLang = useCallback((l: Lang) => {
    applyLang(l);
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/**
 * Icon button in the same visual pattern as ThemeToggle. Shows the two-letter
 * label of the OTHER language: "EN" while Arabic is active, "ع" while English
 * is active. Clicking switches the language.
 */
export function LanguageToggle() {
  const { lang, setLang } = useLang();
  const next: Lang = lang === "ar" ? "en" : "ar";
  const label = next === "en" ? "English" : "العربية";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={label}
      title={label}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="text-xs font-bold" dir="ltr">
        {lang === "ar" ? "EN" : "ع"}
      </span>
    </button>
  );
}