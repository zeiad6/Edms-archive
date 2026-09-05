"use client";

import Link from "next/link";
import { Files, ScanLine, Sparkles, UploadCloud } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

interface DashboardHeroProps {
  greeting: string;
  name: string;
  today: string;
  total: number;
  active: number;
  week: number;
}

/**
 * Hero banner of the dashboard: greeting, quick stats and action links.
 */
export function DashboardHero({ greeting, name, today, total, active, week }: DashboardHeroProps) {
  useLang(); // re-render when the language toggles
  return (
    <section aria-label={t("نبذة اليوم")} className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-indigo-950 via-indigo-800 to-violet-800 p-6 text-white shadow-xl shadow-indigo-600/30 ring-1 ring-inset ring-white/15 sm:p-8 lg:p-10">
      <div aria-hidden className="hero-grid-pattern absolute inset-0" />
      <div aria-hidden className="absolute -end-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="absolute -start-10 bottom-0 h-40 w-40 rounded-full bg-violet-300/20 blur-2xl" />
      <div aria-hidden className="absolute start-1/3 top-0 h-32 w-72 -translate-x-1/2 rounded-full bg-white/5 blur-3xl rtl:translate-x-1/2" />
      <div aria-hidden className="absolute -bottom-20 end-1/4 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-6 lg:gap-10">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-indigo-100">
            <Sparkles className="h-4 w-4 shrink-0" />
            <time>{today}</time>
          </div>
          <h1 className="text-balance text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl lg:text-4xl">{t("{g}، {n}", { g: t(greeting), n: name })}</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-indigo-100/90">
            {t("لديك")} <b className="tnum text-white">{total}</b> {t("مستند في الأرشيف")} · <b className="tnum text-white">{week}</b> {t("جديد هذا الأسبوع.")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/upload" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-800 shadow-md shadow-black/15 transition-all duration-150 hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-800">
              <UploadCloud className="h-4 w-4" /> {t("رفع مستند")}
            </Link>
            <Link href="/scan" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur transition-all duration-150 hover:bg-white/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-800">
              <ScanLine className="h-4 w-4" /> {t("مسح ضوئي")}
            </Link>
            <Link href="/documents" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur transition-all duration-150 hover:bg-white/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-800">
              <Files className="h-4 w-4" /> {t("تصفّح الأرشيف")}
            </Link>
          </div>
        </div>
        <div className="hidden shrink-0 gap-3 min-[960px]:flex sm:flex" role="list" aria-label={t("إحصاءات سريعة")}>
          <HeroStat value={total} label={t("إجمالي")} />
          <HeroStat value={active} label={t("سارية")} />
          <HeroStat value={week} label={t("هذا الأسبوع")} />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div role="listitem" className="min-w-[6rem] rounded-2xl bg-white/[0.08] px-6 py-4 text-center shadow-lg shadow-black/10 ring-1 ring-inset ring-white/15 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.14]">
      <div className="tnum text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-indigo-100">{label}</div>
    </div>
  );
}
