import { Tag } from "lucide-react";
import { cn } from "@/lib/format";

interface TagOption {
  id: number;
  name: string;
  color: string;
}

export function TagSelector({
  tags,
  selectedTags,
  onToggle,
}: {
  tags: TagOption[];
  selectedTags: number[];
  onToggle: (id: number) => void;
}) {
  if (tags.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Tag className="h-3.5 w-3.5" /> الوسوم (اختياري — ستُطبق على جميع الملفات)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => {
          const active = selectedTags.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                active
                  ? "ring-2 ring-offset-1 ring-offset-card"
                  : "opacity-50 hover:opacity-80"
              )}
              style={{
                backgroundColor: `${t.color}18`,
                color: t.color,
                ...(active ? { ringColor: t.color } : {}),
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
