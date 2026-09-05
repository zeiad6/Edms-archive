import Link from "next/link";
import {
  FileText,
  ArrowLeft,
  Hash,
  Calendar,
  HardDrive,
  Layers,
  Tag as TagIcon,
} from "lucide-react";
import { StatusBadge, TypeBadge, ConfidentialTag } from "@/components/ui";
import { cn, formatBytes, formatDate, timeAgo, STATUS_META } from "@/lib/format";
import { Highlight } from "./highlight";
import type { SearchResult } from "./search-types";
import { t as tr } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

interface SearchResultCardProps {
  doc: SearchResult;
  query: string;
}

export function SearchResultCard({ doc, query }: SearchResultCardProps) {
  useLang(); // re-render on language toggle
  return (
    <Link
      href={`/documents/${doc.id}`}
      className="card-interactive group relative block overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card hover:border-primary/30 sm:p-5"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 end-0 w-1 rounded-full",
          STATUS_META[doc.status]?.dot ?? "bg-muted-foreground/20"
        )}
      />
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted/70 shadow-sm ring-1 ring-inset ring-border/50">
          <FileText className="h-6 w-6 text-rose-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-foreground"><Highlight text={doc.title} query={query} /></span>
            <StatusBadge status={doc.status} />
            {doc.confidential ? <ConfidentialTag /> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
            {doc.docNumber && (
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" /> {doc.docNumber}
              </span>
            )}
            {doc.docType && <TypeBadge type={doc.docType} />}
            {doc.deptName && (
              <span style={{ color: doc.deptColor ?? undefined }}>{doc.deptName}</span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {formatDate(doc.docDate)}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" /> {formatBytes(doc.fileSize)}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" /> v{doc.version}
            </span>
            {doc.uploaderName && <span>{tr("بواسطة {n}", { n: doc.uploaderName })}</span>}
            <span>{timeAgo(doc.createdAt)}</span>
          </div>
          {doc.tags && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <TagIcon className="h-3 w-3 text-muted-foreground/60" />
              {doc.tags.split(", ").map((t) => (
                <span key={t} className="rounded-lg bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm ring-1 ring-inset ring-border/40 transition-colors hover:bg-muted">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ArrowLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:-translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}
