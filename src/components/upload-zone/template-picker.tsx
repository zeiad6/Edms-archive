"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useEffect, useState, useRef } from "react";
import { FileText, ChevronDown } from "lucide-react";

interface Template {
  id: number;
  name: string;
  description: string | null;
  titlePattern: string;
  departmentId: number | null;
  folderId: number | null;
  docType: string | null;
  defaultTags: string | null;
}

interface Props {
  onApply: (tpl: Template) => void;
  onTagNames: (tags: string[]) => void;
}

export function TemplatePicker({ onApply, onTagNames }: Props) {
  useLang(); // re-render on language toggle
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedId, setAppliedId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTemplates(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /** Close on outside click */
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function apply(tpl: Template) {
    setAppliedId(tpl.id);
    setOpen(false);
    onApply(tpl);
    if (tpl.defaultTags) {
      onTagNames(tpl.defaultTags.split(",").map((s) => s.trim()).filter(Boolean));
    } else {
      onTagNames([]);
    }
  }

  if (loading || templates.length === 0) return null;

  return (
    <div ref={panelRef} className="relative mb-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{t("قالب سريع")}</span>
        {appliedId && (
          <button
            type="button"
            onClick={() => {
              setAppliedId(null);
              const formEl = panelRef.current?.closest("form");
              if (formEl) {
                const q = <T extends HTMLElement>(sel: string): T | null => formEl.querySelector<T>(sel);
                q<HTMLInputElement>('[name="title"]') && (q<HTMLInputElement>('[name="title"]')!.value = "");
                q<HTMLSelectElement>('[name="departmentId"]') && (q<HTMLSelectElement>('[name="departmentId"]')!.value = "");
                q<HTMLSelectElement>('[name="folderId"]') && (q<HTMLSelectElement>('[name="folderId"]')!.value = "");
                q<HTMLInputElement>('[name="docType"]') && (q<HTMLInputElement>('[name="docType"]')!.value = "");
                q<HTMLTextAreaElement>('[name="description"]') && (q<HTMLTextAreaElement>('[name="description"]')!.value = "");
              }
              onTagNames([]);
            }}
            className="text-[11px] text-muted-foreground underline hover:text-foreground"
          >{t("إلغاء")}</button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-start text-sm shadow-sm transition hover:border-primary/30 hover:bg-muted hover:shadow-md"
      >
        {appliedId ? (
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {templates.find((t) => t.id === appliedId)?.name ?? "..."}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{t("اختر قالباً لملء الحقول تلقائياً...")}</span>
        )}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="surface-pop animate-pop absolute start-0 z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => apply(tpl)}
              className={`flex w-full items-start gap-3 px-3.5 py-3 text-start text-sm transition hover:bg-primary/[0.05] first:rounded-t-2xl last:rounded-b-2xl ${
                appliedId === tpl.id ? "bg-primary/5" : ""
              }`}
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">{tpl.name}</div>
                {tpl.description && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                    {tpl.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Apply a template's values to the upload form.
 * Call this from onApply in the parent.
 */
export function applyTemplateToForm(tpl: Template) {
  // Find the closest form — the picker is inside the upload form
  const form = document.querySelector<HTMLFormElement>("form");
  if (!form) return;

  const setVal = (name: string, value: string) => {
    const el = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
    if (el) el.value = value;
  };

  // Resolve title from pattern
  let title = tpl.titlePattern || "{{title}}";
  title = title.replace("{{title}}", "");
  title = title.replace("{{date}}", new Date().toLocaleDateString("ar-SA"));
  title = title.trim() || tpl.name;

  setVal("title", title);
  setVal("departmentId", tpl.departmentId?.toString() ?? "");
  setVal("folderId", tpl.folderId?.toString() ?? "");
  setVal("docType", tpl.docType ?? "");
  setVal("description", tpl.description ?? "");
}
