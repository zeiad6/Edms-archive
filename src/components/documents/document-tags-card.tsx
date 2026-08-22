import { Tag as TagIcon } from "lucide-react";
import { Card } from "@/components/ui";

interface TagRow {
  name: string;
  color: string;
}

export function DocumentTagsCard({ tagRows }: { tagRows: TagRow[] }) {
  if (tagRows.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <TagIcon className="h-4 w-4 text-primary" /> الوسوم
      </h3>
      <div className="flex flex-wrap gap-2">
        {tagRows.map((t) => (
          <span
            key={t.name}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: `${t.color}1f`, color: t.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.name}
          </span>
        ))}
      </div>
    </Card>
  );
}
