import { FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import type { Template } from "./template-types";
import { t as tr } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

interface TemplateListProps {
  busy: boolean;
  templates: Template[];
  search: string;
  onEdit: (t: Template) => void;
  onDelete: (id: number) => void;
}

export function TemplateList({ busy, templates, search, onEdit, onDelete }: TemplateListProps) {
  useLang(); // re-render on language toggle
  return (
    <Card className="section-card card-sheen animate-rise">
      {busy ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="animate-fadein py-12 text-center text-sm text-muted-foreground">
          <span className="icon-tile mx-auto mb-3 h-14 w-14"><FileText className="h-6 w-6" /></span>
          <p>{search ? tr("لا توجد نتائج للبحث") : tr("لا توجد قوالب بعد. أنشئ قالباً لتبدأ.")}</p>
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="card-interactive group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="icon-tile h-8 w-8 shrink-0 !rounded-xl"><FileText className="h-4 w-4" /></span>
                  <span className="truncate text-sm font-semibold text-foreground">{t.name}</span>
                  {t.docType && (
                    <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/20">
                      {t.docType}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {t.titlePattern && (
                    <span className="rounded-lg bg-muted/70 px-1.5 py-0.5 font-mono ring-1 ring-inset ring-border/50">{tr("العنوان: {x}", { x: t.titlePattern })}</span>
                  )}
                  {t.defaultTags && (
                    <span className="rounded-lg bg-muted/70 px-1.5 py-0.5 ring-1 ring-inset ring-border/50">{tr("الوسوم: {x}", { x: t.defaultTags })}</span>
                  )}
                </div>
              </div>
              <div className="toolbar mt-3 gap-1 border-t border-border/60 pt-2.5">
                <button
                  onClick={() => onEdit(t)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
                >
                  <Pencil className="h-3.5 w-3.5" />{tr("تعديل")}</button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-danger/10 hover:text-danger active:scale-[0.98]"
                >
                  <Trash2 className="h-3.5 w-3.5" />{tr("حذف")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
