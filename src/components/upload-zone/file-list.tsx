import { Layers } from "lucide-react";
import { FileItemRow } from "./file-item-row";
import type { FileItem } from "./types";

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
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Layers className="h-4 w-4 text-primary" />
          {files.length} ملف{doneCount > 0 && ` (تم رفع ${doneCount})`}
        </span>
        {!busy && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              className="text-xs font-medium text-primary hover:opacity-80"
            >
              + إضافة ملفات
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-rose-500 hover:text-rose-400"
            >
              إزالة الكل
            </button>
          </div>
        )}
      </div>
      <div className="max-h-64 divide-y divide-border overflow-y-auto">
        {files.map((item, i) => (
          <FileItemRow key={i} item={item} index={i} busy={busy} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}
