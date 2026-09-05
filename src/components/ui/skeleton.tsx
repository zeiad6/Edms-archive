import { cn } from "@/lib/format";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton-shimmer rounded-xl", className)} aria-hidden {...props} />;
}
