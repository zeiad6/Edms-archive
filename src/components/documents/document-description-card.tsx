import { Card } from "@/components/ui";

interface Doc {
  description: string | null;
}

export function DocumentDescriptionCard({ doc }: { doc: Doc }) {
  if (!doc.description) return null;
  return (
    <Card className="p-5">
      <h3 className="mb-2 text-sm font-bold text-foreground">الوصف</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{doc.description}</p>
    </Card>
  );
}
