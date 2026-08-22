"use client";

import { Camera, Loader2, Save } from "lucide-react";
import { INPUT_CLS, type Option } from "@/lib/scanner";

interface SaveFormProps {
  departments: Option[];
  folders: Option[];
  docTypes: string[];
  busy: boolean;
  pageCount: number;
  docNumberRef: React.RefObject<HTMLInputElement | null>;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
}

/** Archive save form: metadata fields + submit button. */
export function SaveForm({
  departments,
  folders,
  docTypes,
  busy,
  pageCount,
  docNumberRef,
  onSave,
}: SaveFormProps) {
  return (
    <div className="lg:col-span-2">
      <form onSubmit={onSave} className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <Save className="h-4 w-4 text-primary" /> حفظ في الأرشيف
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          أكمل بيانات المستند ثم احفظه. {pageCount > 0 && `${pageCount} صفحة جاهزة للحفظ.`}
        </p>
        <div className="space-y-3">
          <input name="title" required defaultValue="مستند ممسوح ضوئياً" placeholder="العنوان" className={INPUT_CLS} />
          <div className="grid grid-cols-2 gap-3">
            <input name="docNumber" ref={docNumberRef} placeholder="الرقم المرجعي" className={INPUT_CLS} />
            <select name="docType" className={INPUT_CLS} defaultValue="صورة ضوئية">
              {docTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select name="departmentId" className={INPUT_CLS} defaultValue="">
              <option value="">القسم</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select name="folderId" className={INPUT_CLS} defaultValue="">
              <option value="">المجلد</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <textarea name="description" rows={3} placeholder="وصف موجز..." className={INPUT_CLS} />
        </div>
        <button
          type="submit"
          disabled={busy || pageCount === 0}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {busy ? "جاري المعالجة..." : `إيداع المستندات (${pageCount})`}
        </button>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          يعمل الماسح عبر الكاميرا المدمجة أو الخلوية. لا يتطلب تطبيق سطح مكتب.
        </div>
      </form>
    </div>
  );
}