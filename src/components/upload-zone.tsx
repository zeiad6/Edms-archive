"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight upload when the form unmounts — stops the network
  // request and prevents setState on an unmounted component.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    setErr("");
    const newItems: FileItem[] = Array.from(list).map((f) => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
      progress: 0,
      done: false,
    }));
    setFiles((prev) => [...prev, ...newItems]);
  }, []);

  function removeFile(i: number) {
    const item = files[i];
    if (item.preview) URL.revokeObjectURL(item.preview);
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  function clearAll() {
    files.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setFiles([]);
    setSelectedTags([]);
    setErr("");
  }

  function toggleTag(id: number) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function uploadSingle(item: FileItem, idx: number, meta: Record<string, string>): Promise<string | null> {
    const fd = new FormData();
    fd.set("file", item.file);
    Object.entries(meta).forEach(([k, v]) => { if (v) fd.set(k, v); });

    const controller = new AbortController();
    abortRef.current = controller;

    let interval: ReturnType<typeof setInterval> | null = null;
    try {
      // Simulate progress for UX
      interval = setInterval(() => {
        setFiles((prev) => {
          const copy = [...prev];
          if (copy[idx] && !copy[idx].done) {
            copy[idx] = { ...copy[idx], progress: Math.min(95, copy[idx].progress + 8) };
          }
          return copy;
        });
      }, 400);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(t(data.error || "فشل الرفع"));

      setFiles((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], progress: 100, done: true };
        return copy;
      });

      return data.id;
    } catch (e: any) {
      if (e.name === "AbortError") return null;
      setFiles((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], error: t(e.message || "فشل الرفع") };
        return copy;
      });
      return null;
    } finally {
      // Always stop the progress timer — even when fetch throws or is aborted.
      if (interval) clearInterval(interval);
    }
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
    fd.forEach((v, k) => { if (k !== "file") meta[k] = String(v); });
    // append tags
    meta["tags"] = selectedTags.join(",");

    setBusy(true);
    setErr("");

    let uploaded = 0;
    let lastId: string | null = null;
    for (let i = 0; i < files.length; i++) {
      if (files[i].done) continue;
      lastId = await uploadSingle(files[i], i, meta);
      if (lastId) uploaded++;
    }

    setBusy(false);
    if (uploaded === files.length) {
      // All succeeded — stay in place, refresh the list, no forced navigation.
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

  const pendingCount = files.filter((f) => !f.done).length;
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
              .map((n) => tags.find((t) => t.name === n)?.id)
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
