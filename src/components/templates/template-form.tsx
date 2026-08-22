import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui";
import type { DeptFolder, Template, TemplateFormValues } from "./template-types";

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
  return (
    <Card className="mb-6 p-5">
      <h3 className="mb-4 text-sm font-bold text-foreground">{editing ? "تعديل القالب" : "قالب جديد"}</h3>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">اسم القالب *</label>
            <input
              required
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="مثال: عقد توريد"
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">نمط العنوان</label>
            <input
              value={form.titlePattern}
              onChange={(e) => onChange({ titlePattern: e.target.value })}
              placeholder={'{{title}}'}
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[11px] text-muted-foreground">استخدم {'{{title}}'} و {'{{date}}'} كمتغيرات</p>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">الوصف</label>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            placeholder="وصف القالب ونطاق استخدامه..."
            className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">القسم الافتراضي</label>
            <select
              value={form.departmentId}
              onChange={(e) => onChange({ departmentId: e.target.value })}
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— غير محدد —</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">المجلد الافتراضي</label>
            <select
              value={form.folderId}
              onChange={(e) => onChange({ folderId: e.target.value })}
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— غير محدد —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">نوع المستند</label>
            <input
              value={form.docType}
              onChange={(e) => onChange({ docType: e.target.value })}
              placeholder="مثال: عقد"
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">الوسوم (مفصولة بفواصل)</label>
          <input
            value={form.defaultTags}
            onChange={(e) => onChange({ defaultTags: e.target.value })}
            placeholder="مثال: عقود,توريد,سنوي"
            className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "تحديث" : "إنشاء"}
          </button>
        </div>
      </form>
    </Card>
  );
}
