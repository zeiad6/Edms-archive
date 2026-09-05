"use client";

import { AppLogo } from "@/components/app-logo";
import { LanguageToggle } from "@/components/lang-provider";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

/**
 * Login page header (client component): language toggle in the top corner,
 * brand logo with a soft glow halo, translated heading/subtitle. The page
 * itself stays a server component — only this block re-renders on toggle.
 *
 * The toggle is absolutely positioned against the page's relative container.
 * The credit footer (dev + phone) renders at the bottom of the page column
 * inside LoginTabs, so the header stays compact and centered.
 *
 * Text sits directly on the always-dark gradient backdrop, so it uses
 * white-based alpha tones instead of theme tokens — readable in both the
 * day and dark appearance.
 *
 * Portable runtime (`light`) switches to the light token theme to match the
 * app default background. Defaults to the dark backdrop (Setup/dev unchanged).
 */
export function LoginHeader({ light = false }: { light?: boolean }) {
  useLang(); // re-render on language toggle
  return (
    <>
      <div className="absolute end-0 top-0">
        <LanguageToggle />
      </div>

      <div className="mb-8 text-center">
        <div className="relative mx-auto mb-4 w-fit">
          {/* Soft halo behind the logo mark */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute -inset-4 rounded-full blur-2xl ${light ? "bg-primary/15 dark:bg-primary/30" : "bg-primary/30"}`}
          />
          <AppLogo
            size={72}
            className={`relative rounded-2xl shadow-xl ${light ? "shadow-primary/20 ring-1 ring-border" : "shadow-primary/40 ring-1 ring-white/20"}`}
          />
        </div>
        <h1 className={`text-[1.7rem] font-extrabold leading-tight ${light ? "text-foreground" : "text-white"}`}>
          {t("نظام الأرشفة الإلكترونية")}
        </h1>
        <p className={`mt-1.5 text-sm ${light ? "text-muted-foreground" : "text-white/65"}`}>
          {t("سجّل دخولك للمتابعة إلى الأرشيف")}
        </p>
      </div>
    </>
  );
}