"use client";

import { Plus, Loader2, UploadCloud } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { Field, inputCls } from "./shared";
import type { FileItem } from "./types";

interface Option {
  id: number;
  name: string;
}

export function MetadataPanel({
  departments,
  folders,
  docTypes,
  files,
  selectedTags,
  busy,
  doneCount,
}: {
  departments: Option[];
  folders: Option[];
  docTypes: string[];
  files: FileItem[];
  selectedTags: number[];
  busy: boolean;
  doneCount: number;
}) {
  const totalSize = files.reduce((s, f) => s + f.file.size, 0);

  return (
    <div className="w-full space-y-4">
      <div className="w-full rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-bold text-foreground">البيانات الوصفية للمستندات</h3>
        {/* Responsive metadata grid filling the whole panel width: short fields
            (ref, date, type, source, department, folder) flow side by side —
            2 columns on tablets/laptops, 3 on very wide screens; long fields
            (title, keywords, description, notes) span the full width. */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          <div className="sm:col-span-2 2xl:col-span-3">
            <Field label="عنوان المستند *">
              <input name="title" required placeholder="مثال: عقد توريد أجهزة" className={inputCls} />
            </Field>
          </div>

          <Field label="الرقم المرجعي">
            <input name="docNumber" placeholder="م-2024/001" className={inputCls} />
          </Field>
          <Field label="تاريخ المستند">
            <input name="docDate" type="date" className={inputCls} />
          </Field>
          <Field label="نوع المستند">
            <input name="docType" list="docTypeList" placeholder="اختر أو اكتب..." className={inputCls} />
            <datalist id="docTypeList">
              {docTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="مصدر المستند">
            <input name="source" list="sourceList" placeholder="اختر أو اكتب..." className={inputCls} />
            <datalist id="sourceList">
              <option value="بريد وارد" />
              <option value="بريد صادر" />
              <option value="فاكس" />
              <option value="يدوي" />
              <option value="داخلي" />
              <option value="أخرى" />
            </datalist>
          </Field>

          <QuickSelect
            label="القسم"
            addLabel="إضافة"
            onAdd={async () => {
              const name = prompt("اسم القسم الجديد:");
              if (!name?.trim()) return;
              try {
                const fd = new FormData();
                fd.set("name", name.trim());
                const res = await fetch("/api/quick/department", { method: "POST", body: fd });
                if (!res.ok) throw new Error((await res.json()).error || "فشل");
                window.location.reload();
              } catch (e) {
                alert(e instanceof Error ? e.message : "فشل");
              }
            }}
          >
            <select name="departmentId" className={inputCls} defaultValue="">
              <option value="">— اختر —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </QuickSelect>

          <QuickSelect
            label="المجلد"
            addLabel="إضافة"
            onAdd={async () => {
              const name = prompt("اسم المجلد الجديد:");
              if (!name?.trim()) return;
              try {
                const fd = new FormData();
                fd.set("name", name.trim());
                const res = await fetch("/api/quick/folder", { method: "POST", body: fd });
                if (!res.ok) throw new Error((await res.json()).error || "فشل");
                window.location.reload();
              } catch (e) {
                alert(e instanceof Error ? e.message : "فشل");
              }
            }}
          >
            <select name="folderId" className={inputCls} defaultValue="">
              <option value="">— اختر —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </QuickSelect>

          <div className="sm:col-span-2 2xl:col-span-3">
            <Field label="الكلمات المفتاحية">
              <input name="keywords" placeholder="مفصولة بفواصل، مثال: عقد، توريد، 2024" className={inputCls} />
            </Field>
          </div>

          <div className="sm:col-span-2 2xl:col-span-3">
            <Field label="وصف / ملخص">
              <textarea name="description" rows={3} placeholder="ملخص موجز لمحتوى المستند..." className={inputCls} />
            </Field>
          </div>

          <div className="sm:col-span-2 2xl:col-span-3">
            <Field label="ملاحظات">
              <textarea name="notes" rows={2} placeholder="ملاحظات داخلية (اختياري)..." className={inputCls} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2 2xl:col-span-3">
            <input type="checkbox" name="confidential" className="h-4 w-4 rounded border-border bg-muted text-primary" />
            مستند سري (تقييد الوصول للمدراء فقط)
          </label>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>الملفات المحددة</span>
              <span className="font-bold text-foreground">{files.length}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>الحجم الإجمالي</span>
              <span className="font-bold text-foreground">{formatBytes(totalSize)}</span>
            </div>
            {selectedTags.length > 0 && (
              <div className="mt-1 flex items-center justify-between">
                <span>الوسوم</span>
                <span className="font-bold text-foreground">{selectedTags.length}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || files.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {busy
              ? `جارٍ الرفع... (${doneCount}/${files.length})`
              : `إيداع ${files.length > 1 ? `${files.length} مستندات` : "المستند"} في الأرشيف`}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickSelect({
  label,
  addLabel,
  onAdd,
  children,
}: {
  label: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:opacity-80"
        >
          <Plus className="h-3 w-3" /> {addLabel}
        </button>
      </div>
      {children}
    </div>
  );
}