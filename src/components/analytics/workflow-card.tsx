import { Workflow } from "lucide-react";
import { Card } from "@/components/ui";
import { MermaidRenderer } from "@/components/mermaid-renderer";
import { EDMS_DIAGRAMS } from "@/lib/edms-diagrams";

/** Document workflow sequence diagram (Mermaid). */
export function WorkflowCard() {
  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
        <Workflow className="h-4 w-4 text-primary" /> دورة حفظ المستند
      </h3>
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <MermaidRenderer definition={EDMS_DIAGRAMS.workflowSequence()} type="sequence" />
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 border-t border-border/60 pt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        مسار المستند من الرفع حتى الأرشفة النهائية مع فحص الباركود والتأكيد
      </p>
    </Card>
  );
}
