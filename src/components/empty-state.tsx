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
  /** Compact variant for inside cards/lists (smaller paddings & icon). */
  compact?: boolean;
  className?: string;
}

/**
 * Unified empty-state. Never leave a surface blank:
 * icon + title + description + optional action.
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 px-4 py-8" : "gap-2 px-6 py-16",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-2xl bg-primary/5 text-primary/70 shadow-sm shadow-primary/10 ring-1 ring-inset ring-primary/20",
          compact ? "h-10 w-10" : "h-14 w-14"
        )}
      >
        <Icon className={compact ? "h-5 w-5" : "h-7 w-7"} />
      </span>
      <h4 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</h4>
      {description && (
        <p className={cn("max-w-sm text-muted-foreground", compact ? "text-xs" : "text-sm")}>{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-150 hover:bg-primary/90 active:scale-[0.98]",
            compact && "mt-2"
          )}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
