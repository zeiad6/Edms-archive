import { Card, StatusBadge, TypeBadge, ConfidentialTag, VerifiedTag } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { DocumentPreview } from "./document-preview";

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

export function DocumentPreviewCard({ doc, meta }: { doc: Doc; meta: Meta | undefined }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[16/9] bg-muted">
        <DocumentPreview id={doc.id} mime={doc.mimeType} ext={doc.fileExt} title={doc.title} fileSize={doc.fileSize} />
        <div className="absolute right-3 top-3 flex gap-2">
          <StatusBadge status={doc.status} />
          {doc.confidential && <ConfidentialTag />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        {doc.docType && <TypeBadge type={doc.docType} color={meta?.docTypeColor} />}
        <VerifiedTag />
        <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)} · {(doc.fileExt || "ملف").toUpperCase()}</span>
      </div>
    </Card>
  );
}
