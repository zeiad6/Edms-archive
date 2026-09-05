import { Card, StatusBadge, TypeBadge, ConfidentialTag, VerifiedTag } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { DocumentPreview } from "./document-preview";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface Doc {
  id: number;
  mimeType: string;
  fileExt: string | null;
  title: string;
  fileSize: number;
  status: string;
  confidential: number;
  docType: string | null;
}

interface Meta {
  docTypeColor: string | null;
}

export async function DocumentPreviewCard({ doc, meta }: { doc: Doc; meta: Meta | undefined }) {
  const lang = await getServerLang();
  return (
    <Card className="card-sheen overflow-hidden">
      <div className="relative aspect-[16/9] bg-muted">
        <DocumentPreview id={doc.id} mime={doc.mimeType} ext={doc.fileExt} title={doc.title} fileSize={doc.fileSize} />
        <div className="absolute end-3 top-3 flex gap-2">
          <StatusBadge status={doc.status} />
          {doc.confidential && <ConfidentialTag />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
        {doc.docType && <TypeBadge type={doc.docType} color={meta?.docTypeColor} />}
        <VerifiedTag />
        <span className="tnum text-xs text-muted-foreground">{formatBytes(doc.fileSize)} · {(doc.fileExt || ts(lang, "ملف")).toUpperCase()}</span>
      </div>
    </Card>
  );
}
