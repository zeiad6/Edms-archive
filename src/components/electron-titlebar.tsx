"use client";
/*
 * Custom title bar for the packaged Electron app (frame:false).
 *
 * - Whole bar is a drag region (`-webkit-app-region: drag` in globals.css).
 * - Interactive buttons are `no-drag` (CSS) so clicks reach them.
 * - Rendered only when the Electron bridge exists; invisible in the browser.
 * - Double-click on the bar toggles maximize (native OS behavior).
 */
import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

type ShellState = { maximized: boolean; fullscreen: boolean };

export function ElectronTitleBar() {
  const [state, setState] = useState<ShellState>({ maximized: false, fullscreen: false });
  const [enabled, setEnabled] = useState(false);
  useLang(); // re-render when the language toggles

  useEffect(() => {
    const shell = (window as any).edmsShell;
    if (!shell) return;
    setEnabled(true);
    let disposed = false;
    shell.getState().then((s: ShellState) => {
      if (!disposed) setState(s);
    });
    const off = shell.onStateChange((s: ShellState) => {
      if (!disposed) setState(s);
    });
    return () => {
      disposed = true;
      off?.();
    };
  }, []);

  if (!enabled) return null;

  const shell = (window as any).edmsShell;
  const onDoubleClick = () => shell?.maximizeToggle();

  return (
    <div
      data-edms-titlebar
      onDoubleClick={onDoubleClick}
      className="flex h-9 shrink-0 items-center justify-between border-b border-[#c7d2e2] bg-titlebar pl-2 pr-3 shadow-[0_2px_10px_-5px_rgba(15,23,42,0.28)] select-none dark:border-border/60 dark:shadow-none"
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-[11px] font-semibold text-foreground/90">{t("أرشيف — نظام الأرشفة الإلكتروني")}</span>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">{t("EDMS")}</span>
      </div>

      <div className="flex items-center gap-0.5" data-edms-titlebar-buttons>
        <button
          type="button"
          aria-label={t("تصغير")}
          title={t("تصغير")}
          onClick={() => shell?.minimize()}
          className="flex h-7 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={state.maximized ? t("استعادة") : t("تكبير")}
          title={state.maximized ? t("استعادة") : t("تكبير")}
          onClick={() => shell?.maximizeToggle()}
          className="flex h-7 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {state.maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
        <button
          type="button"
          aria-label={t("إغلاق")}
          title={t("إغلاق")}
          onClick={() => shell?.close()}
          className="ms-0.5 flex h-7 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-600 hover:text-white active:bg-red-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
