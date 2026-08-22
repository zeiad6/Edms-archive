import { Tags } from "lucide-react";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";

interface PopularTagsCardProps {
  tagStats: Array<{ name: string; color: string; c: number }>;
}

/**
 * Most-used tags cloud with usage counts.
 */
export function PopularTagsCard({ tagStats }: PopularTagsCardProps) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
        <Tags className="h-4 w-4 text-primary" /> الوسوم الأكثر استخداماً
      </h3>
      {tagStats.length === 0 ? (
        <EmptyState compact icon={Tags} title="لا توجد وسوم بعد" description="أضف وسوماً عند إيداع المستندات لتصنيفها بسهولة." />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tagStats.map((t) => (
            <span
              key={t.name}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:-translate-y-0.5 hover:opacity-90"
              style={{ backgroundColor: `${t.color}18`, color: t.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
              <span className="font-bold opacity-60">{t.c}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
