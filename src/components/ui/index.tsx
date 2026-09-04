"use client";

import type { ReactNode } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileType2,
  File,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { cn, STATUS_META, docTypeStyle, isImage, initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

export function Card({
  className,
  children,
  interactive,
}: {
  className?: string;
  children: ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-card",
        interactive && "card-interactive",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-black/[0.06] dark:ring-white/10",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.active;
  return (
    <Badge className={m.badge}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </Badge>
  );
}

export function TypeBadge({ type, color }: { type: string | null; color?: string | null }) {
  if (!type) return null;
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
      style={docTypeStyle(color ?? undefined)}
    >
      {type}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const s = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-card",
        s
      )}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  useLang(); // re-render when the language toggles
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t(title)}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{t(subtitle)}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  delta,
  accent = "indigo",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: { value: string; up?: boolean };
  accent?: "indigo" | "emerald" | "amber" | "sky" | "rose" | "violet";
}) {
  const accents: Record<string, string> = {
    indigo: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-inset ring-violet-500/20",
  };
  return (
    <Card interactive className="group relative overflow-hidden p-5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/30">
      <div aria-hidden className="pointer-events-none absolute -end-8 -top-8 h-24 w-24 rounded-full bg-primary/[0.06] blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-muted-foreground">{label}</span>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110", accents[accent])}>
          {icon}
        </span>
      </div>
      <div className="relative mt-3 flex items-end justify-between gap-2">
        <div className="tnum text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
        {delta && (
          <span className={cn("tnum rounded-full px-2 py-0.5 text-[11px] font-bold", delta.up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>{delta.value}</span>
        )}
      </div>
      {hint && <div className="relative mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export function ConfidentialTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
      <Lock className="h-3 w-3" /> سري
    </span>
  );
}

export function VerifiedTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
      <ShieldCheck className="h-3 w-3" /> موثّق
    </span>
  );
}

function ExtIcon({ ext }: { ext: string }) {
  if (["xls", "xlsx"].includes(ext)) return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />;
  if (["doc", "docx"].includes(ext)) return <FileType2 className="h-8 w-8 text-sky-500" />;
  if (["pdf"].includes(ext)) return <FileText className="h-8 w-8 text-rose-500" />;
  return <File className="h-8 w-8 text-muted-foreground" />;
}

export function Thumb({
  id,
  mime,
  ext,
  title,
  className,
}: {
  id: number;
  mime: string;
  ext: string | null;
  title: string;
  className?: string;
}) {
  if (isImage(mime)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dynamic API document thumbnail with cache-busting query
      <img
        src={`/api/documents/${id}/file?t=1`}
        alt={title}
        loading="lazy"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-1 bg-muted", className)}>
      <ExtIcon ext={ext || ""} />
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{ext || "ملف"}</span>
    </div>
  );
}
