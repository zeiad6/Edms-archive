import { Pencil } from "lucide-react";
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
  "w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";

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
  return (
    <div className="px-1 pb-1 pt-4">
      <form action={updateDocument} className="space-y-3">
        <input type="hidden" name="id" value={doc.id} />
        <input name="title" defaultValue={doc.title} placeholder="العنوان" className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <input name="docNumber" defaultValue={doc.docNumber ?? ""} placeholder="الرقم" className={inputCls} />
          <select name="docType" defaultValue={doc.docType ?? ""} className={inputCls}>
            <option value="">النوع</option>
            {allDocTypes.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select name="departmentId" defaultValue={doc.departmentId ? String(doc.departmentId) : ""} className={inputCls}>
            <option value="">القسم</option>
            {allDepts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select name="folderId" defaultValue={doc.folderId ? String(doc.folderId) : ""} className={inputCls}>
            <option value="">المجلد</option>
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
              {v.label}
            </option>
          ))}
        </select>
        <textarea
          name="description"
          defaultValue={doc.description ?? ""}
          rows={2}
          placeholder="الوصف"
          className={inputCls}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="confidential"
            defaultChecked={!!doc.confidential}
            className="h-4 w-4 rounded border-border bg-muted text-primary"
          />
          مستند سري
        </label>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Pencil className="h-4 w-4" /> حفظ التعديلات
        </button>
      </form>
    </div>
  );
}
