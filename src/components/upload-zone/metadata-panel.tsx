"use client";
import { t as tr } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

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
  useLang(); // re-render on language toggle
  const totalSize = files.reduce((s, f) => s + f.file.size, 0);

  return (
    <div className="w-full space-y-4">
      <div className="section-card card-sheen w-full">
        <h3 className="mb-4 text-sm font-bold text-foreground">{tr("البيانات الوصفية للمستندات")}</h3>
        {/* Responsive metadata grid filling the whole panel width: short fields
            (ref, date, type, source, department, folder) flow side by side —
            2 columns on tablets/laptops, 3 on very wide screens; long fields
            (title, keywords, description, notes) span the full width. */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          <div className="sm:col-span-2 2xl:col-span-3">
            <Field label={tr("عنوان المستند *")}>
              <input name="title" required placeholder={tr("مثال: عقد توريد أجهزة")} className={inputCls} />
            </Field>
          </div>

          <Field label={tr("الرقم المرجعي")}>
            <input name="docNumber" placeholder={tr("م-2024/001")} className={inputCls} />
          </Field>
          <Field label={tr("تاريخ المستند")}>
            <input name="docDate" type="date" className={inputCls} />
          </Field>
          <Field label={tr("نوع المستند")}>
            <input name="docType" list="docTypeList" placeholder={tr("اختر أو اكتب...")} className={inputCls} />
            <datalist id="docTypeList">
              {docTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label={tr("مصدر المستند")}>
            <input name="source" list="sourceList" placeholder={tr("اختر أو اكتب...")} className={inputCls} />
            <datalist id="sourceList">
              <option value="بريد وارد">{tr("بريد وارد")}</option>
              <option value="بريد صادر">{tr("بريد صادر")}</option>
              <option value="فاكس">{tr("فاكس")}</option>
              <option value="يدوي">{tr("يدوي")}</option>
              <option value="داخلي">{tr("داخلي")}</option>
              <option value="أخرى">{tr("أخرى")}</option>
            </datalist>
          </Field>

          <QuickSelect
            label={tr("القسم")}
            addLabel={tr("إضافة")}
            onAdd={async () => {
              const name = prompt(tr("اسم القسم الجديد:"));
              if (!name?.trim()) return;
              try {
                const fd = new FormData();
                fd.set("name", name.trim());
                const res = await fetch("/api/quick/department", { method: "POST", body: fd });
                if (!res.ok) throw new Error((await res.json()).error || "فشل");
                window.location.reload();
              } catch (e) {
                alert(e instanceof Error ? tr(e.message) : tr("فشل"));
              }
            }}
          >
            <select name="departmentId" className={inputCls} defaultValue="">
              <option value="">{tr("— اختر —")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </QuickSelect>

          <QuickSelect
            label={tr("المجلد")}
            addLabel={tr("إضافة")}
            onAdd={async () => {
              const name = prompt(tr("اسم المجلد الجديد:"));
              if (!name?.trim()) return;
              try {
                const fd = new FormData();
                fd.set("name", name.trim());
                const res = await fetch("/api/quick/folder", { method: "POST", body: fd });
                if (!res.ok) throw new Error((await res.json()).error || "فشل");
                window.location.reload();
              } catch (e) {
                alert(e instanceof Error ? tr(e.message) : tr("فشل"));
              }
            }}
          >
            <select name="folderId" className={inputCls} defaultValue="">
              <option value="">{tr("— اختر —")}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </QuickSelect>

          <div className="sm:col-span-2 2xl:col-span-3">
            <Field label={tr("الكلمات المفتاحية")}>
              <input name="keywords" placeholder={tr("مفصولة بفواصل، مثال: عقد، توريد، 2024")} className={inputCls} />
            </Field>
          </div>

          <div className="sm:col-span-2 2xl:col-span-3">
            <Field label={tr("وصف / ملخص")}>
              <textarea name="description" rows={3} placeholder={tr("ملخص موجز لمحتوى المستند...")} className={inputCls} />
            </Field>
          </div>

          <div className="sm:col-span-2 2xl:col-span-3">
            <Field label={tr("ملاحظات")}>
              <textarea name="notes" rows={2} placeholder={tr("ملاحظات داخلية (اختياري)...")} className={inputCls} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2 2xl:col-span-3">
            <input type="checkbox" name="confidential" className="h-4 w-4 rounded border-border bg-muted text-primary" />{tr("مستند سري (تقييد الوصول للمدراء فقط)")}</label>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl bg-muted/60 p-3.5 text-xs text-muted-foreground ring-1 ring-inset ring-border/50">
            <div className="flex items-center justify-between">
              <span>{tr("الملفات المحددة")}</span>
              <span className="font-bold text-foreground">{files.length}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>{tr("الحجم الإجمالي")}</span>
              <span className="font-bold text-foreground">{formatBytes(totalSize)}</span>
            </div>
            {selectedTags.length > 0 && (
              <div className="mt-1 flex items-center justify-between">
                <span>{tr("الوسوم")}</span>
                <span className="font-bold text-foreground">{selectedTags.length}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || files.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:shadow-lg hover:shadow-primary/30 hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {busy
              ? tr("جارٍ الرفع... ({d}/{f})", { d: doneCount, f: files.length })
              : tr("إيداع {x} في الأرشيف", { x: files.length > 1 ? tr("{n} مستندات", { n: files.length }) : tr("المستند") })}
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
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-primary transition hover:bg-primary/10 hover:opacity-80"
        >
          <Plus className="h-3 w-3" /> {addLabel}
        </button>
      </div>
      {children}
    </div>
  );
}