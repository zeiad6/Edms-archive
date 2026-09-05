"use client";
import { t as tr } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { Camera, FileCheck2, Loader2, Save } from "lucide-react";
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
  useLang(); // re-render on language toggle
  const ready = pageCount > 0;
  return (
    <div className="lg:col-span-2">
      <form
        onSubmit={onSave}
        aria-label={tr("حفظ في الأرشيف")}
        className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-4"
      >
        <h3 className="flex flex-wrap items-center gap-2.5 text-sm font-extrabold tracking-tight text-foreground">
          <span className="icon-tile h-9 w-9 rounded-xl">
            <Save className="h-4 w-4" />
          </span>{tr("حفظ في الأرشيف")}<span className={`ms-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ready ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400" : "bg-muted text-muted-foreground ring-border"}`}>
            <FileCheck2 className="h-3 w-3" />
            <span className="tnum">{pageCount}</span> {tr(pageCount === 1 ? "صفحة" : "صفحات")} {tr("جاهزة")}
          </span>
        </h3>
        <p className="mb-4 mt-1.5 text-xs leading-5 text-muted-foreground">
          {tr("أكمل بيانات المستند ثم احفظه.")} {ready ? tr("الصفحات مرتبة وجاهزة للإيداع.") : tr("امسح صفحة واحدة على الأقل لتفعيل الإيداع.")}
        </p>
        <fieldset disabled={busy} className="space-y-3 disabled:opacity-70">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground">{tr("العنوان")}<span className="text-rose-500">*</span></span>
            <input name="title" required defaultValue={tr("مستند ممسوح ضوئياً")} placeholder={tr("العنوان")} autoComplete="off" className={INPUT_CLS} />
          </label>
          <div className="grid grid-cols-1 gap-3 min-[960px]:grid-cols-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-foreground">{tr("الرقم المرجعي")}</span>
              <input name="docNumber" ref={docNumberRef} placeholder={tr("يُعبأ تلقائياً من الباركود")} autoComplete="off" dir="ltr" className={`${INPUT_CLS} text-left`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-foreground">{tr("نوع المستند")}</span>
              <select name="docType" className={INPUT_CLS} defaultValue="صورة ضوئية">
                {docTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 min-[960px]:grid-cols-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-foreground">{tr("القسم")}</span>
              <select name="departmentId" className={INPUT_CLS} defaultValue="">
                <option value="">{tr("القسم")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-foreground">{tr("المجلد")}</span>
              <select name="folderId" className={INPUT_CLS} defaultValue="">
                <option value="">{tr("المجلد")}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground">{tr("الوصف")}</span>
            <textarea name="description" rows={3} placeholder={tr("وصف موجز...")} className={`${INPUT_CLS} resize-y leading-6`} />
          </label>
        </fieldset>
        <button
          type="submit"
          disabled={busy || !ready}
          aria-disabled={busy || !ready}
          title={!ready ? tr("امسح صفحة واحدة على الأقل أولاً") : undefined}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-sm transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {busy ? tr("جارٍ المعالجة...") : ready ? tr("إيداع المستند ({n})", { n: pageCount }) : tr("بانتظار صفحات للمسح")}
        </button>
        {!ready && (
          <p role="note" className="mt-2 text-center text-[11px] text-muted-foreground">{tr("زر الإيداع يُفعّل بعد إضافة أول صفحة")}</p>
        )}
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground ring-1 ring-inset ring-border/60">
          <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0" />{tr("يعمل الماسح عبر الكاميرا المدمجة أو الخلوية. لا يتطلب تطبيق سطح مكتب.")}</div>
      </form>
    </div>
  );
}
