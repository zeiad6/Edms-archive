import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";

export interface EmptyStateProps {
  /** Icon to show above the title (defaults to Inbox). */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional single action shown below the description. */
  action?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  /** Compact variant for inside cards/lists (smaller paddings & icon). */
  compact?: boolean;
  className?: string;
}

/**
 * Unified empty-state. Never leave a surface blank:
 * icon + title + description + optional action.
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, secondaryAction, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden text-center shadow-soft",
        compact ? "gap-1.5 rounded-2xl border border-dashed border-border bg-gradient-to-b from-card to-muted/30 px-4 py-8" : "gap-2.5 rounded-3xl border border-dashed border-border bg-gradient-to-b from-card via-card to-muted/40 px-6 py-14 sm:py-16",
        className
      )}
    >
      <span aria-hidden className="mesh-dots pointer-events-none absolute inset-0 opacity-40" />
      <span aria-hidden className="pointer-events-none absolute -top-16 start-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl rtl:translate-x-1/2" />
      <span
        className={cn(
          "relative flex items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-card ring-1 ring-inset ring-primary/25",
          compact ? "h-11 w-11 rounded-2xl" : "h-16 w-16"
        )}
      >
        <Icon className={compact ? "h-5 w-5" : "h-8 w-8"} />
      </span>
      <h4 className={cn("relative font-extrabold tracking-tight text-foreground", compact ? "text-sm" : "text-[15px] sm:text-base")}>{title}</h4>
      {description && (
        <p className={cn("relative leading-6 text-muted-foreground", compact ? "max-w-xs text-xs" : "max-w-md text-[13px] sm:text-sm")}>{description}</p>
      )}
      {action && (
        <span className="relative mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href={action.href}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-[13px] font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all duration-150 hover:-translate-y-px hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]",
            )}
          >
            {action.label}
          </Link>
          {secondaryAction && (
            <Link href={secondaryAction.href} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-5 py-2 text-[13px] font-semibold text-foreground shadow-sm transition hover:bg-muted hover:shadow">
              {secondaryAction.label}
            </Link>
          )}
        </span>
      )}
    </div>
  );
}
