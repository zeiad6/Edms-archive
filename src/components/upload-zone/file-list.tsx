import { Layers } from "lucide-react";
import { FileItemRow } from "./file-item-row";
import type { FileItem } from "./types";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

export function FileList({
  files,
  busy,
  doneCount,
  onAdd,
  onClear,
  onRemove,
}: {
  files: FileItem[];
  busy: boolean;
  doneCount: number;
  onAdd: () => void;
  onClear: () => void;
  onRemove: (i: number) => void;
}) {
  useLang(); // re-render on language toggle
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <span className="tnum flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Layers className="h-4 w-4 text-primary" />
          {t("{n} ملف", { n: files.length })}{doneCount > 0 && t(" (تم رفع {n})", { n: doneCount })}
        </span>
        {!busy && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              className="text-xs font-medium text-primary hover:opacity-80"
            >{t("+ إضافة ملفات")}</button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-rose-500 hover:text-rose-400"
            >{t("إزالة الكل")}</button>
          </div>
        )}
      </div>
      <div className="max-h-72 divide-y divide-border overflow-y-auto">
        {files.map((item, i) => (
          <FileItemRow key={i} item={item} index={i} busy={busy} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}
