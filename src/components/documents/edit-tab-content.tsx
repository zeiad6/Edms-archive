"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateDocument } from "@/actions/documents";
import { STATUS_META } from "@/lib/format";

interface DocRef {
  id: number;
  title: string;
  docNumber: string | null;
  docType: string | null;
  departmentId: number | null;
  folderId: number | null;
  status: string;
  description: string | null;
  confidential: number;
}

interface DeptItem {
  id: number;
  name: string;
}

interface FolderItem {
  id: number;
  name: string;
}

interface DocTypeItem {
  id: number;
  name: string;
}

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";

export function EditTabContent({
  doc,
  allDepts,
  allFolders,
  allDocTypes,
}: {
  doc: DocRef;
  allDepts: DeptItem[];
  allFolders: FolderItem[];
  allDocTypes: DocTypeItem[];
}) {
  useLang(); // re-render on language toggle
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDocument(new FormData(e.currentTarget));
      toast.success(t("تم حفظ التعديلات"));
    } catch (err) {
      toast.error(err instanceof Error ? t(err.message) : t("فشل الحفظ"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-1 pb-1 pt-4">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <input type="hidden" name="id" value={doc.id} />
        <input name="title" defaultValue={doc.title} placeholder={t("العنوان")} className={inputCls} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="docNumber" defaultValue={doc.docNumber ?? ""} placeholder={t("الرقم")} className={inputCls} />
          <select name="docType" defaultValue={doc.docType ?? ""} className={inputCls}>
            <option value="">{t("النوع")}</option>
            {allDocTypes.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select name="departmentId" defaultValue={doc.departmentId ? String(doc.departmentId) : ""} className={inputCls}>
            <option value="">{t("القسم")}</option>
            {allDepts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select name="folderId" defaultValue={doc.folderId ? String(doc.folderId) : ""} className={inputCls}>
            <option value="">{t("المجلد")}</option>
            {allFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <select name="status" defaultValue={doc.status} className={inputCls}>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v.label)}
            </option>
          ))}
        </select>
        <textarea
          name="description"
          defaultValue={doc.description ?? ""}
          rows={2}
          placeholder={t("الوصف")}
          className={inputCls}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="confidential"
            defaultChecked={!!doc.confidential}
            className="h-4 w-4 rounded border-border bg-muted text-primary"
          />{t("مستند سري")}</label>
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:-translate-y-px hover:opacity-90 hover:shadow-lg active:translate-y-0 disabled:opacity-60"
        >
          <Pencil className="h-4 w-4" />{saving ? t("جارٍ الحفظ…") : t("حفظ التعديلات")}</button>
      </form>
    </div>
  );
}
