import { type RefObject } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/format";

export function DropZone({
  inputRef,
  drag,
  onDrag,
  onFilesAdded,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  drag: boolean;
  onDrag: (v: boolean) => void;
  onFilesAdded: (list: FileList | null) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); onDrag(true); }}
      onDragLeave={() => onDrag(false)}
      onDrop={(e) => { e.preventDefault(); onDrag(false); onFilesAdded(e.dataTransfer.files); }}
      className={cn(
        "flex h-60 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition",
        drag ? "border-primary bg-primary/5" : "border-border bg-muted hover:border-primary/40 hover:bg-primary/5"
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-primary shadow-sm ring-1 ring-border">
        <UploadCloud className="h-8 w-8" />
      </div>
      <div>
        <div className="font-semibold text-foreground">اسحب الملفات هنا أو اضغط للاختيار</div>
        <div className="mt-1 text-xs text-muted-foreground">
          الصور · PDF · مستندات Office — يمكنك اختيار عدة ملفات
        </div>
      </div>
    </button>
  );
}
