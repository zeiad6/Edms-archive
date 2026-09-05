import { ScanText } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/format";
import { runDocumentOcr } from "@/actions/documents";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

interface Doc {
  id: number;
  ocrProcessed: number;
  contentText: string | null;
}

export async function OcrCard({ doc }: { doc: Doc }) {
  const lang = await getServerLang();
  return (
    <Card className="card-sheen p-4 sm:p-5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="icon-tile h-7 w-7 bg-primary/10 text-primary [&_svg]:h-3.5 [&_svg]:w-3.5"><ScanText className="h-3.5 w-3.5" /></span>{ts(lang, "النص المستخرج (OCR)")}</h3>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-soft ring-1 ring-inset",
            doc.ocrProcessed
              ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
          )}
        >
          {doc.ocrProcessed ? ts(lang, "مُعالَج") : ts(lang, "بانتظار المعالجة")}
        </span>
      </div>
      <p className="rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground shadow-inner">
        {doc.contentText || ts(lang, "لا يوجد نص مستخرج بعد. سيُفهرس المحتوى تلقائياً في محرك البحث بعد المعالجة.")}
      </p>
      {!doc.ocrProcessed && (
        <form action={runDocumentOcr} className="mt-3">
          <input type="hidden" name="id" value={doc.id} />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:-translate-y-px hover:opacity-90 hover:shadow-lg active:translate-y-0"
          >
            <ScanText className="h-4 w-4" />{ts(lang, "تشغيل استخراج النص (OCR)")}</button>
        </form>
      )}
    </Card>
  );
}
