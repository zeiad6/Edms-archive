import { FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import type { Template } from "./template-types";

interface TemplateListProps {
  busy: boolean;
  templates: Template[];
  search: string;
  onEdit: (t: Template) => void;
  onDelete: (id: number) => void;
}

export function TemplateList({ busy, templates, search, onEdit, onDelete }: TemplateListProps) {
  return (
    <Card className="p-5">
      {busy ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto mb-2 h-10 w-10 opacity-40" />
          <p>{search ? "لا توجد نتائج للبحث" : "لا توجد قوالب بعد. أنشئ قالباً لتبدأ."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/30 hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary/60" />
                  <span className="truncate text-sm font-semibold text-foreground">{t.name}</span>
                  {t.docType && (
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {t.docType}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {t.titlePattern && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono">العنوان: {t.titlePattern}</span>
                  )}
                  {t.defaultTags && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5">الوسوم: {t.defaultTags}</span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 border-t border-border/60 pt-2.5">
                <button
                  onClick={() => onEdit(t)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
