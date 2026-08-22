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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-indigo-700 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-indigo-600/25 sm:p-8">
      <div className="absolute -end-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -start-10 bottom-0 h-40 w-40 rounded-full bg-violet-300/20 blur-2xl" />
      <div className="absolute start-1/3 top-0 h-32 w-72 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-indigo-100">
            <Sparkles className="h-4 w-4" /> {today}
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t(greeting)}، {name} 👋</h1>
          <p className="mt-1 max-w-lg text-sm text-indigo-100">
            {t("لديك")} <b className="text-white">{total}</b> {t("مستند في الأرشيف")} · <b className="text-white">{week}</b> {t("جديد هذا الأسبوع.")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/upload" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-md shadow-black/10 transition-all duration-150 hover:bg-indigo-50 hover:shadow-lg hover:shadow-black/15 active:scale-[0.98]">
              <UploadCloud className="h-4 w-4" /> {t("رفع مستند")}
            </Link>
            <Link href="/scan" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur transition-all duration-150 hover:bg-white/25 active:scale-[0.98]">
              <ScanLine className="h-4 w-4" /> {t("مسح ضوئي")}
            </Link>
            <Link href="/documents" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur transition-all duration-150 hover:bg-white/25 active:scale-[0.98]">
              <Files className="h-4 w-4" /> {t("تصفّح الأرشيف")}
            </Link>
          </div>
        </div>
        <div className="hidden gap-4 sm:flex">
          <HeroStat value={total} label={t("إجمالي")} />
          <HeroStat value={active} label={t("سارية")} />
          <HeroStat value={week} label={t("هذا الأسبوع")} />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-5 py-4 text-center ring-1 ring-inset ring-white/15 backdrop-blur">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-indigo-100">{label}</div>
    </div>
  );
}
