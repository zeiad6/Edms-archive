"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Sparkles, Check } from "lucide-react";
import { DropZone } from "@/components/upload-zone/drop-zone";
import { FileList } from "@/components/upload-zone/file-list";
import { TagSelector } from "@/components/upload-zone/tag-selector";
import { MetadataPanel } from "@/components/upload-zone/metadata-panel";
import { TemplatePicker, applyTemplateToForm } from "@/components/upload-zone/template-picker";
import type { FileItem } from "@/components/upload-zone/types";

interface Option {
  id: number;
  name: string;
}
interface TagOption {
  id: number;
  name: string;
  color: string;
}

interface SuggestedMetadata {
  title?: string;
  docNumber?: string;
  docDate?: string;
  docType?: string;
  keywords?: string;
  description?: string;
}

/**
 * Extract smart metadata suggestions from filename and/or OCR text snippet.
 */
export function extractSuggestedMetadata(fileName: string, ocrText: string = ""): SuggestedMetadata {
  const cleanBase = fileName.replace(/\.[^.]+$/, "").trim();
  const combined = `${cleanBase}\n${ocrText}`;
  const out: SuggestedMetadata = {};

  // Reference number pattern (e.g. ق-2024/102, DOC-2025-01, ع-٢٠٢٤/٠٠٧٨)
  const refMatch = /(?:[أ-يA-Za-z]{1,4}[-/]\s*[0-9٠-٩]{2,4}(?:[-/][0-9٠-٩]{1,6})?)/.exec(combined);
  if (refMatch) {
    out.docNumber = refMatch[0].trim();
  }

  // Date pattern (YYYY-MM-DD)
  const dateMatch = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/.exec(combined);
  if (dateMatch) {
    out.docDate = dateMatch[0];
  }

  // Document type detection
  const knownTypes: Array<[RegExp, string]> = [
    [/قرار/i, "قرار إداري"],
    [/فاتور[ةه]|invoice/i, "فاتورة"],
    [/عقد|اتفاقي[ةه]|contract/i, "عقد"],
    [/محضر/i, "محضر اجتماع"],
    [/تقرير|report/i, "تقرير"],
    [/خطاب|تعميم|مراسل[ةه]/i, "مراسلة رسمية"],
  ];
  for (const [re, label] of knownTypes) {
    if (re.test(combined)) {
      out.docType = label;
      break;
    }
  }

  // Extract top keywords from OCR or filename
  const words = combined
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4);
  const uniqueWords = Array.from(new Set(words)).slice(0, 6);
  if (uniqueWords.length > 0) {
    out.keywords = uniqueWords.join("، ");
  }

  if (ocrText.trim().length > 0) {
    out.description = ocrText.trim().slice(0, 220);
  }
  if (cleanBase) {
    out.title = cleanBase;
  }

  return out;
}

export function UploadForm({
  departments,
  folders,
  tags,
  docTypes,
}: {
  departments: Option[];
  folders: Option[];
  tags: TagOption[];
  docTypes: string[];
}) {
  useLang(); // re-render on language toggle
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [err, setErr] = useState("");
  const [suggestion, setSuggestion] = useState<SuggestedMetadata | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeXhrsRef = useRef<Set<XMLHttpRequest>>(new Set());

  // Abort any in-flight XHR uploads when the form unmounts
  useEffect(() => {
    const xhrs = activeXhrsRef.current;
    return () => {
      for (const xhr of xhrs) {
        try {
          xhr.abort();
        } catch {
          /* ignore */
        }
      }
      xhrs.clear();
    };
  }, []);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    setErr("");
    const arr = Array.from(list);
    const newItems: FileItem[] = arr.map((f) => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
      progress: 0,
      done: false,
    }));
    setFiles((prev) => [...prev, ...newItems]);

    if (arr[0]) {
      const initialSuggestion = extractSuggestedMetadata(arr[0].name);
      setSuggestion(initialSuggestion);
    }
  }, []);

  function applySuggestedMetadata(s: SuggestedMetadata) {
    const form = formRef.current;
    if (!form) return;
    const setField = (name: string, val?: string) => {
      if (!val) return;
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && !el.value.trim()) {
        el.value = val;
      }
    };
    setField("title", s.title);
    setField("docNumber", s.docNumber);
    setField("docDate", s.docDate);
    setField("docType", s.docType);
    setField("keywords", s.keywords);
    setField("description", s.description);
    toast.success(t("تم تطبيق البيانات الوصفية المقترحة"));
  }

  function removeFile(i: number) {
    const item = files[i];
    if (item?.preview) URL.revokeObjectURL(item.preview);
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  function clearAll() {
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    setSelectedTags([]);
    setSuggestion(null);
    setErr("");
  }

  function toggleTag(id: number) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((tg) => tg !== id) : [...prev, id],
    );
  }

  function uploadSingleWithRealProgress(
    item: FileItem,
    idx: number,
    meta: Record<string, string>,
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.set("file", item.file);
      Object.entries(meta).forEach(([k, v]) => {
        if (v) fd.set(k, v);
      });

      const xhr = new XMLHttpRequest();
      activeXhrsRef.current.add(xhr);

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const pct = Math.min(99, Math.max(1, Math.round((ev.loaded / ev.total) * 100)));
        setFiles((prev) => {
          const copy = [...prev];
          if (copy[idx] && !copy[idx].done) {
            copy[idx] = { ...copy[idx], progress: pct };
          }
          return copy;
        });
      };

      xhr.onload = () => {
        activeXhrsRef.current.delete(xhr);
        let data: { id?: number | string; error?: string } = {};
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {
          data = {};
        }

        if (xhr.status >= 200 && xhr.status < 300 && data.id) {
          setFiles((prev) => {
            const copy = [...prev];
            if (copy[idx]) {
              copy[idx] = { ...copy[idx], progress: 100, done: true, error: undefined };
            }
            return copy;
          });
          resolve(String(data.id));
        } else {
          const message = t(data.error || "فشل الرفع");
          setFiles((prev) => {
            const copy = [...prev];
            if (copy[idx]) {
              copy[idx] = { ...copy[idx], error: message };
            }
            return copy;
          });
          resolve(null);
        }
      };

      xhr.onerror = () => {
        activeXhrsRef.current.delete(xhr);
        setFiles((prev) => {
          const copy = [...prev];
          if (copy[idx]) {
            copy[idx] = { ...copy[idx], error: t("فشل الرفع") };
          }
          return copy;
        });
        resolve(null);
      };

      xhr.onabort = () => {
        activeXhrsRef.current.delete(xhr);
        resolve(null);
      };

      xhr.open("POST", "/api/upload");
      xhr.send(fd);
    });
  }

  // Poll OCR snippet briefly after upload to enrich metadata suggestions
  function fetchOcrSuggestions(docId: string, fileName: string) {
    setTimeout(() => {
      fetch(`/api/documents/${docId}/summary`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const snippet = data?.document?.ocrSnippet;
          if (typeof snippet === "string" && snippet.trim().length > 0) {
            const enriched = extractSuggestedMetadata(fileName, snippet);
            setSuggestion(enriched);
          }
        })
        .catch(() => {});
    }, 1500);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0) {
      setErr(t("الرجاء اختيار ملف واحد على الأقل"));
      return;
    }
    const form = formRef.current!;
    const fd = new FormData(form);
    const meta: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (k !== "file") meta[k] = String(v);
    });
    meta["tags"] = selectedTags.join(",");

    setBusy(true);
    setErr("");

    let uploaded = 0;
    let lastId: string | null = null;
    for (let i = 0; i < files.length; i++) {
      if (files[i].done) {
        uploaded++;
        continue;
      }
      lastId = await uploadSingleWithRealProgress(files[i], i, meta);
      if (lastId) {
        uploaded++;
        fetchOcrSuggestions(lastId, files[i].file.name);
      }
    }

    setBusy(false);
    if (uploaded === files.length) {
      toast.success(t("تم رفع الملفات بنجاح"));
      router.refresh();
    } else if (uploaded > 0) {
      const msg = t("تم رفع {u} من {f} ملف. بعض الملفات فشلت.", { u: uploaded, f: files.length });
      setErr(msg);
      toast.error(msg);
    } else {
      const msg = t("فشل رفع جميع الملفات. تحقق من الاتصال وحاول مجدداً.");
      setErr(msg);
      toast.error(msg);
    }
  }

  const doneCount = files.filter((f) => f.done).length;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-5">
      {/* Drop zone + file list */}
      <div className="space-y-3 lg:col-span-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf"
          onChange={(e) => addFiles(e.target.files)}
        />

        {files.length === 0 ? (
          <DropZone
            inputRef={inputRef}
            drag={drag}
            onDrag={setDrag}
            onFilesAdded={addFiles}
          />
        ) : (
          <FileList
            files={files}
            busy={busy}
            doneCount={doneCount}
            onAdd={() => inputRef.current?.click()}
            onClear={clearAll}
            onRemove={removeFile}
          />
        )}

        {suggestion && (suggestion.docNumber || suggestion.docType || suggestion.keywords || suggestion.description) && (
          <div className="animate-fadein rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-3.5 text-xs">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {t("بيانات وصفية مقترحة تلقائياً (OCR)")}
              </span>
              <button
                type="button"
                onClick={() => applySuggestedMetadata(suggestion)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
              >
                <Check className="h-3 w-3" />
                {t("تعبئة الحقول الفارغة")}
              </button>
            </div>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              {suggestion.docType && (
                <div>
                  <span className="font-semibold text-foreground">{t("النوع المقترح:")}</span> {suggestion.docType}
                </div>
              )}
              {suggestion.docNumber && (
                <div>
                  <span className="font-semibold text-foreground">{t("الرقم المرجعي:")}</span> {suggestion.docNumber}
                </div>
              )}
              {suggestion.keywords && (
                <div>
                  <span className="font-semibold text-foreground">{t("كلمات مفتاحية:")}</span> {suggestion.keywords}
                </div>
              )}
            </div>
          </div>
        )}

        <TagSelector tags={tags} selectedTags={selectedTags} onToggle={toggleTag} />

        {err && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {err}
          </div>
        )}
      </div>

      {/* Metadata side panel */}
      <div className="space-y-3 lg:col-span-3">
        <TemplatePicker
          onApply={(tpl) => applyTemplateToForm(tpl)}
          onTagNames={(names) => {
            const ids = names
              .map((n) => tags.find((tg) => tg.name === n)?.id)
              .filter(Boolean) as number[];
            setSelectedTags(ids);
          }}
        />
        <MetadataPanel
          departments={departments}
          folders={folders}
          docTypes={docTypes}
          files={files}
          selectedTags={selectedTags}
          busy={busy}
          doneCount={doneCount}
        />
      </div>
    </form>
  );
}
