import { Card } from "@/components/ui";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface Doc {
  description: string | null;
}

export async function DocumentDescriptionCard({ doc }: { doc: Doc }) {
  const lang = await getServerLang();
  if (!doc.description) return null;
  return (
    <Card className="card-sheen p-4 sm:p-5">
      <h3 className="mb-1.5 text-sm font-bold text-foreground">{ts(lang, "الوصف")}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{doc.description}</p>
    </Card>
  );
}
