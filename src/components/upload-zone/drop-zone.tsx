import { type RefObject } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

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
  useLang(); // re-render on language toggle
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); onDrag(true); }}
      onDragLeave={() => onDrag(false)}
      onDrop={(e) => { e.preventDefault(); onDrag(false); onFilesAdded(e.dataTransfer.files); }}
      className={cn(
        "group flex min-h-64 w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-10 text-center shadow-soft transition-all duration-200 hover:shadow-card sm:min-h-72",
        drag ? "scale-[1.01] border-primary bg-primary/[0.07] shadow-lg shadow-primary/15" : "border-border bg-gradient-to-b from-muted/50 to-muted/20 hover:border-primary/40 hover:bg-primary/[0.04]"
      )}
      aria-label={t("منطقة رفع الملفات")}
    >
      <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-card ring-1 ring-inset ring-primary/25 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-1">
        <UploadCloud className="h-9 w-9" />
      </div>
      <div>
        <div className="text-[15px] font-extrabold tracking-tight text-foreground">{t("اسحب الملفات هنا أو اضغط للاختيار")}</div>
        <div className="mx-auto mt-1.5 max-w-md text-xs leading-6 text-muted-foreground">{t("الصور · PDF · مستندات Office — يمكنك اختيار عدة ملفات")}</div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary ring-1 ring-inset ring-primary/20">{t("حد أقصى 50MB للملف")}</div>
      </div>
    </button>
  );
}
