"use client";
/*
 * Custom title bar for the packaged Electron app (frame:false).
 *
 * - Whole bar is a drag region (`-webkit-app-region: drag` in globals.css).
 * - Interactive buttons are `no-drag` (CSS) so clicks reach them.
 * - Rendered only when the Electron bridge exists; invisible in the browser.
 * - Double-click on the bar toggles maximize (native OS behavior).
 * - RTL: window glyphs sit at the visual end (left in RTL) to mirror native
 *   Windows Arabic chrome; title + badge anchor at the start (right).
 */
import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";
import { cn } from "@/lib/format";

type ShellState = { maximized: boolean; fullscreen: boolean };

const WIN_BTN =
  "flex h-7 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ElectronTitleBar() {
  const [state, setState] = useState<ShellState>({ maximized: false, fullscreen: false });
  const [enabled, setEnabled] = useState(false);
  useLang(); // re-render when the language toggles

  useEffect(() => {
    const shell = (window as unknown as { edmsShell?: {
      getState: () => Promise<ShellState>;
      onStateChange: (cb: (s: ShellState) => void) => (() => void) | undefined;
      minimize: () => void; maximizeToggle: () => void; close: () => void;
    } }).edmsShell;
    if (!shell) return;
    setEnabled(true);
    let disposed = false;
    shell.getState().then((s: ShellState) => {
      if (!disposed) setState(s);
    }).catch(() => {});
    const off = shell.onStateChange((s: ShellState) => {
      if (!disposed) setState(s);
    });
    return () => {
      disposed = true;
      off?.();
    };
  }, []);

  if (!enabled) return null;

  const shell = (window as unknown as { edmsShell?: {
    minimize: () => void; maximizeToggle: () => void; close: () => void;
  } }).edmsShell;
  const onDoubleClick = () => shell?.maximizeToggle();

  return (
    <div
      data-edms-titlebar
      onDoubleClick={onDoubleClick}
      role="banner"
      aria-label={t("شريط عنوان التطبيق")}
      className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-titlebar/90 py-0 pe-2 ps-3 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_2px_10px_-5px_rgba(15,23,42,0.28)] backdrop-blur-xl select-none dark:shadow-none"
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <AppLogo size={20} className="shrink-0 rounded-md shadow-sm" />
        <span className="truncate text-[12px] font-bold text-foreground/90">{t("أرشيف — نظام الأرشفة الإلكتروني")}</span>
        <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary ring-1 ring-inset ring-primary/20">EDMS</span>
        {state.fullscreen && (
          <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 ring-1 ring-inset ring-amber-500/25 dark:text-amber-400">
            {t("ملء الشاشة")}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5" data-edms-titlebar-buttons role="group" aria-label={t("أزرار النافذة")}>
        <button
          type="button"
          aria-label={t("تصغير")}
          title={t("تصغير")}
          onClick={() => shell?.minimize()}
          className={cn(WIN_BTN, "hover:bg-foreground/10")}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={state.maximized ? t("استعادة") : t("تكبير")}
          title={state.maximized ? t("استعادة") : t("تكبير")}
          aria-pressed={state.maximized}
          onClick={() => shell?.maximizeToggle()}
          className={WIN_BTN}
        >
          {state.maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
        <button
          type="button"
          aria-label={t("إغلاق")}
          title={t("إغلاق")}
          onClick={() => shell?.close()}
          className="ms-0.5 flex h-7 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-600 hover:text-white active:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
