import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui";
import type { DeptFolder, Template, TemplateFormValues } from "./template-types";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

interface TemplateFormProps {
  editing: Template | null;
  form: TemplateFormValues;
  saving: boolean;
  depts: DeptFolder[];
  folders: DeptFolder[];
  onChange: (patch: Partial<TemplateFormValues>) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

export function TemplateForm({
  editing,
  form,
  saving,
  depts,
  folders,
  onChange,
  onSubmit,
  onCancel,
}: TemplateFormProps) {
  useLang(); // re-render on language toggle
  return (
    <Card className="section-card card-sheen animate-rise">
      <h3 className="section-title mb-4">{editing ? t("تعديل القالب") : t("قالب جديد")}</h3>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="form-grid">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("اسم القالب *")}</label>
            <input
              required
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={t("مثال: عقد توريد")}
              className="min-h-[2.625rem] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-soft outline-none transition placeholder:text-muted-foreground/60 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("نمط العنوان")}</label>
            <input
              value={form.titlePattern}
              onChange={(e) => onChange({ titlePattern: e.target.value })}
              placeholder={'{{title}}'}
              className="min-h-[2.625rem] w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-sm text-foreground shadow-soft outline-none transition placeholder:text-muted-foreground/60 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-muted-foreground">{t("استخدم {a} و {b} كمتغيرات", { a: "{{title}}", b: "{{date}}" })}</p>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t("الوصف")}</label>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            placeholder={t("وصف القالب ونطاق استخدامه...")}
            className="min-h-[5.5rem] w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm leading-7 text-foreground shadow-soft outline-none transition placeholder:text-muted-foreground/60 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="form-grid">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("القسم الافتراضي")}</label>
            <select
              value={form.departmentId}
              onChange={(e) => onChange({ departmentId: e.target.value })}
              className="min-h-[2.625rem] w-full cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{t("— غير محدد —")}</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("المجلد الافتراضي")}</label>
            <select
              value={form.folderId}
              onChange={(e) => onChange({ folderId: e.target.value })}
              className="min-h-[2.625rem] w-full cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{t("— غير محدد —")}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("نوع المستند")}</label>
            <input
              value={form.docType}
              onChange={(e) => onChange({ docType: e.target.value })}
              placeholder={t("مثال: عقد")}
              className="min-h-[2.625rem] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-soft outline-none transition placeholder:text-muted-foreground/60 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t("الوسوم (مفصولة بفواصل)")}</label>
          <input
            value={form.defaultTags}
            onChange={(e) => onChange({ defaultTags: e.target.value })}
            placeholder={t("مثال: عقود,توريد,سنوي")}
            className="min-h-[2.625rem] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-soft outline-none transition placeholder:text-muted-foreground/60 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="toolbar justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-soft transition hover:bg-muted hover:text-foreground active:scale-[0.98]"
          >{t("إلغاء")}</button>
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 hover:shadow-card active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? t("تحديث") : t("إنشاء")}
          </button>
        </div>
      </form>
    </Card>
  );
}
