"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

/** Reactively tracks whether the document root currently has the `dark` class. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export function ThemeToggle() {
  useLang(); // re-render on language toggle
  const dark = useIsDark();

  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? t("تبديل الوضع النهاري") : t("تبديل الوضع الليلي")}
      aria-pressed={dark}
      title={dark ? t("الوضع النهاري") : t("الوضع الليلي")}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Sun className={`h-[18px] w-[18px] transition-all ${dark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"} absolute`} />
      <Moon className={`h-[18px] w-[18px] transition-all ${dark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"} absolute`} />
    </button>
  );
}
