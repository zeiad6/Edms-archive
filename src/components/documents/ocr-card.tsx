import { ScanText } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/format";
import { runDocumentOcr } from "@/actions/documents";

interface Doc {
  id: number;
  ocrProcessed: number;
  contentText: string | null;
}

export function OcrCard({ doc }: { doc: Doc }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <ScanText className="h-4 w-4 text-primary" /> النص المستخرج (OCR)
        </h3>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            doc.ocrProcessed
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          )}
        >
          {doc.ocrProcessed ? "مُعالَج" : "بانتظار المعالجة"}
        </span>
      </div>
      <p className="rounded-xl bg-muted p-4 text-sm leading-loose text-muted-foreground">
        {doc.contentText || "لا يوجد نص مستخرج بعد. سيُفهرس المحتوى تلقائياً في محرك البحث بعد المعالجة."}
      </p>
      {!doc.ocrProcessed && (
        <form action={runDocumentOcr} className="mt-3">
          <input type="hidden" name="id" value={doc.id} />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <ScanText className="h-4 w-4" />
            تشغيل استخراج النص (OCR)
          </button>
        </form>
      )}
    </Card>
  );
}
