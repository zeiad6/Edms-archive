import { Tag as TagIcon } from "lucide-react";
import { Card } from "@/components/ui";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface TagRow {
  name: string;
  color: string;
}

export async function DocumentTagsCard({ tagRows }: { tagRows: TagRow[] }) {
  const lang = await getServerLang();
  if (tagRows.length === 0) return null;
  return (
    <Card className="card-sheen p-4 sm:p-5">
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-foreground">
        <span className="icon-tile h-7 w-7 bg-primary/10 text-primary [&_svg]:h-3.5 [&_svg]:w-3.5"><TagIcon className="h-3.5 w-3.5" /></span>{ts(lang, "الوسوم")}</h3>
      <div className="flex flex-wrap gap-2">
        {tagRows.map((t) => (
          <span
            key={t.name}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium shadow-soft ring-1 ring-inset ring-current/10 transition hover:shadow-card"
            style={{ backgroundColor: `${t.color}1f`, color: t.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full shadow-sm" style={{ backgroundColor: t.color }} />
            {t.name}
          </span>
        ))}
      </div>
    </Card>
  );
}
