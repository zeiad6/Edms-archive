import { GitBranch } from "lucide-react";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/empty-state";
import { MermaidRenderer } from "@/components/mermaid-renderer";
import { EDMS_DIAGRAMS } from "@/lib/edms-diagrams";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface FolderStructureCardProps {
  folders: Array<{ name: string; count: number }>;
}

/** Folder structure tree (Mermaid) with per-folder document counts. */
export async function FolderStructureCard({ folders }: FolderStructureCardProps) {
  const lang = await getServerLang();
  const diagram =
    folders.length > 0
      ? EDMS_DIAGRAMS.folderTree(
          folders.map((f) => ({
            name: `${f.name || ts(lang, "مجلد غير مسمى")} (${f.count})`,
            children: [],
          }))
        )
      : "";

  return (
    <Card className="p-5 xl:col-span-2">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
        <GitBranch className="h-4 w-4 text-primary" />{ts(lang, "هيكل المجلدات")}</h3>
      {folders.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={ts(lang, "لا توجد مجلدات بعد")}
          description={ts(lang, "عند إنشاء المجلدات وإيداع المستندات فيها تظهر الشجرة هنا.")}
        />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <MermaidRenderer definition={diagram} type="flowchart" />
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 border-t border-border/60 pt-3 text-center text-[11px] leading-relaxed text-muted-foreground">{ts(lang, "الرقم بين قوسين = عدد المستندات في المجلد")}</p>
        </>
      )}
    </Card>
  );
}
