import {
  Hash,
  FileText,
  Building2,
  FolderClosed,
  Calendar,
  HardDrive,
  Layers,
  Clock,
  ShieldAlert,
  BadgeCheck,
  FileType2,
  User,
} from "lucide-react";
import { Card, Avatar } from "@/components/ui";
import { formatDate, formatBytes } from "@/lib/format";
import { InfoRow } from "./info-row";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface Meta {
  deptName: string | null;
  folderName: string | null;
  docTypeColor: string | null;
  uploaderName: string | null;
  uploaderColor: string | null;
  uploaderTitle: string | null;
}

interface Doc {
  id?: number;
  docNumber: string | null;
  docType: string | null;
  fileSize: number;
  docDate: string | null;
  createdAt: Date | string;
  pageCount: number | null;
  version: number;
  updatedAt: Date | string | null;
  status?: string;
  confidential?: boolean | number;
  mimeType?: string;
}

export async function DocumentSidebar({ doc, meta }: { doc: Doc; meta: Meta }) {
  const lang = await getServerLang();
  const statusLabel: Record<string, string> = {
    draft: ts(lang, "مسودة"),
    pending_review: ts(lang, "قيد المراجعة"),
    active: ts(lang, "نشط"),
    archived: ts(lang, "مؤرشف"),
  };
  const statusDot: Record<string, string> = {
    draft: "bg-slate-400",
    pending_review: "bg-amber-500",
    active: "bg-emerald-500",
    archived: "bg-sky-500",
  };
  const isConfidential = doc.confidential === true || doc.confidential === 1;
  const status = doc.status ?? "active";
  const mimeLabel = doc.mimeType ? doc.mimeType.split("/")[1]?.toUpperCase() ?? doc.mimeType : null;

  return (
    <Card className="card-sheen p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <span className="icon-tile h-7 w-7 bg-primary/10 text-primary [&_svg]:h-3.5 [&_svg]:w-3.5"><FileText className="h-3.5 w-3.5" /></span>{ts(lang, "معلومات المستند")}</h3>

      {/* Metadata grid: 1 column on mobile, 2 on sm and up — avoids cramped 3-col layout. */}
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 xl:grid-cols-2">
        <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label={ts(lang, "الرقم المرجعي")} value={doc.docNumber ?? "—"} />
        <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label={ts(lang, "النوع")} value={doc.docType ?? "—"} />
        <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label={ts(lang, "القسم")} value={meta.deptName ?? ts(lang, "غير محدد")} />
        <InfoRow icon={<FolderClosed className="h-3.5 w-3.5" />} label={ts(lang, "المجلد")} value={meta.folderName ?? ts(lang, "غير محدد")} />
        <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label={ts(lang, "تاريخ المستند")} value={formatDate(doc.docDate)} />
        <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label={ts(lang, "تاريخ الإيداع")} value={formatDate(doc.createdAt)} />
        {doc.updatedAt && (
          <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label={ts(lang, "آخر تحديث")} value={formatDate(doc.updatedAt)} />
        )}
        <InfoRow icon={<HardDrive className="h-3.5 w-3.5" />} label={ts(lang, "الحجم")} value={formatBytes(doc.fileSize)} />
        <InfoRow icon={<Layers className="h-3.5 w-3.5" />} label={ts(lang, "الصفحات / الإصدار")} value={`${doc.pageCount ?? 1} · v${doc.version}`} />
        {doc.status && (
          <InfoRow
            icon={<BadgeCheck className="h-3.5 w-3.5" />}
            label={ts(lang, "الحالة")}
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${statusDot[status] ?? "bg-slate-400"}`} />
                {statusLabel[status] ?? status}
              </span>
            }
          />
        )}
        {mimeLabel && (
          <InfoRow icon={<FileType2 className="h-3.5 w-3.5" />} label={ts(lang, "نوع الملف")} value={mimeLabel} />
        )}
        {isConfidential && (
          <InfoRow
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            label={ts(lang, "السرية")}
            value={
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{ts(lang, "سري")}</span>
            }
          />
        )}
      </div>

      {meta.uploaderName && (
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
          <Avatar name={meta.uploaderName} color={meta.uploaderColor ?? "#475569"} size="sm" />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {meta.uploaderName}
            </div>
            <div className="text-[11px] text-muted-foreground">{meta.uploaderTitle ?? ts(lang, "المُودِع")}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
