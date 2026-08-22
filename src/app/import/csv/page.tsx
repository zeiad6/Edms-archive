"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { UploadStep } from "@/components/import/csv-upload-step";
import { PreviewStep } from "@/components/import/csv-preview-step";
import { DoneStep } from "@/components/import/csv-done-step";
import type { Step, CsvRow, ApiResponse } from "@/lib/csv-import";

export default function CsvImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const handleParsed = (h: string[], r: CsvRow[]) => {
    setHeaders(h);
    setRows(r);
    setStep("preview");
  };

  const handleImport = async (mapping: Record<string, string>) => {
    setImporting(true);
    try {
      const res = await fetch("/api/documents/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mapping }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "فشل الاتصال" }));
        toast.error(err.error || "خطأ في الاستيراد");
        return;
      }
      const data: ApiResponse = await res.json();
      setResult(data);
      setStep("done");
      toast.success(`تم استيراد ${data.imported} مستند${data.imported !== 1 ? "ات" : ""}`);
    } catch (e) {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setResult(null);
    setImporting(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Steps indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {(["upload", "preview", "done"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                step === s
                  ? "bg-indigo-600 text-white"
                  : step === "done" && s === "done"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {step === "done" && s === "done" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : s === "done" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-xs ${
                step === s
                  ? "font-semibold text-indigo-600 dark:text-indigo-400"
                  : "text-gray-400"
              }`}
            >
              {s === "upload" ? "رفع الملف" : s === "preview" ? "معاينة" : "اكتمال"}
            </span>
            {i < 2 && (
              <div
                className={`h-px w-8 ${
                  (step === "preview" || step === "done") && i === 0
                    ? "bg-indigo-500"
                    : step === "done" && i === 1
                    ? "bg-indigo-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === "upload" && <UploadStep onParsed={handleParsed} />}
      {step === "preview" && (
        <PreviewStep
          headers={headers}
          rows={rows}
          onBack={() => setStep("upload")}
          onImport={handleImport}
          importing={importing}
        />
      )}
      {step === "done" && result && (
        <DoneStep result={result} onReset={handleReset} />
      )}
    </div>
  );
}
