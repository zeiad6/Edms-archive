import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Card, StatusBadge } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { formatDate, isImage } from "@/lib/format";
import type { EnrichedDocument } from "@/lib/dashboard-helpers";
import type { Document } from "@/db/schema";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface RecentDocumentsCardProps {
  recent: EnrichedDocument[];
}

/**
 * Latest accessible documents list (thumbnail, meta, status).
 */
export async function RecentDocumentsCard({ recent }: RecentDocumentsCardProps) {
  const lang = await getServerLang();
  return (
    <Card className="lg:col-span-2">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-bold text-foreground">{ts(lang, "أحدث المستندات")}</h3>
        <Link href="/documents" className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors duration-150 hover:text-primary/80">{ts(lang, "عرض الكل")}<ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {recent.map((d) => (
          <Link
            key={d.id}
            href={`/documents/${d.id}`}
            className="group flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-muted"
          >
            <div className="h-11 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-border">
              <MiniThumb doc={d} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{d.title}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                {d.docNumber && <span className="font-mono">{d.docNumber}</span>}
                {d.departmentName && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.departmentColor ?? "#94a3b8" }} />
                    {d.departmentName}
                  </span>
                )}
                <span>· {formatDate(d.createdAt)}</span>
              </div>
            </div>
            <StatusBadge status={d.status} />
            <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all duration-150 group-hover:-translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
        {recent.length === 0 && (
          <EmptyState
            compact
            icon={FileText}
            title={ts(lang, "لا توجد مستندات متاحة لك حالياً")}
            description={ts(lang, "عند إيداع أول مستند سيظهر هنا مباشرة.")}
            action={{ label: ts(lang, "رفع مستند"), href: "/upload" }}
          />
        )}
      </div>
    </Card>
  );
}

function MiniThumb({ doc }: { doc: Document }) {
  if (isImage(doc.mimeType)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/documents/${doc.id}/file?t=1`} alt={doc.title} loading="lazy" className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <FileText className="h-4 w-4 text-rose-400" />
    </div>
  );
}
