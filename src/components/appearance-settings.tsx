"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useIsDark } from "@/components/theme-provider";
import { cn } from "@/lib/format";

export function AppearanceSettings() {
  const dark = useIsDark();

  function apply(theme: "light" | "dark" | "system") {
    const root = document.documentElement;
    let isDark = theme === "dark";
    if (theme === "system") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    root.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("theme", theme === "system" ? (isDark ? "dark" : "light") : theme);
    } catch {
      /* ignore */
    }
  }

  const options: Array<{ key: "light" | "dark" | "system"; label: string; icon: typeof Sun; active: boolean }> = [
    { key: "light", label: "نهاري", icon: Sun, active: !dark },
    { key: "dark", label: "ليلي", icon: Moon, active: dark },
    { key: "system", label: "تلقائي", icon: Monitor, active: false },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.key}
            onClick={() => apply(opt.key)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border p-5 transition",
              opt.active
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-card hover:bg-muted"
            )}
          >
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", opt.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              <Icon className="h-5 w-5" />
            </span>
            <span className={cn("text-sm font-semibold", opt.active ? "text-primary" : "text-foreground")}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
