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
        "group flex h-60 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition-all duration-200",
        drag ? "scale-[1.01] border-primary bg-primary/[0.07] shadow-lg shadow-primary/10" : "border-border bg-muted/40 hover:border-primary/40 hover:bg-primary/[0.04]"
      )}
      aria-label="منطقة رفع الملفات"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-primary shadow-card ring-1 ring-inset ring-primary/20 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5">
        <UploadCloud className="h-8 w-8" />
      </div>
      <div>
        <div className="font-bold text-foreground">اسحب الملفات هنا أو اضغط للاختيار</div>
        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
          الصور · PDF · مستندات Office — يمكنك اختيار عدة ملفات
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">حد أقصى 50MB للملف</div>
      </div>
    </button>
  );
}
