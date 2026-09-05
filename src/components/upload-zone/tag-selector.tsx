import { Tag } from "lucide-react";
import { cn } from "@/lib/format";
import { t as tr } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

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
  useLang(); // re-render on language toggle
  if (tags.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Tag className="h-3.5 w-3.5" />{tr("الوسوم (اختياري — ستُطبق على جميع الملفات)")}</div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          const active = selectedTags.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-inset transition hover:-translate-y-px hover:shadow-md active:scale-[0.97]",
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
