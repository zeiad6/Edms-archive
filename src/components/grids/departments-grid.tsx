"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState, useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { updateDepartment, deleteDepartment } from "@/actions/departments";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface DeptRow {
  id: number;
  name: string;
  nameEn: string | null;
  code: string | null;
  description: string | null;
  color: string;
  docs: number;
  members: number;
}

/** Column definitions rebuilt when the language toggles (headers). */
function buildColumns(): ColDef<DeptRow>[] {
  return [
    {
      headerName: t("القسم"),
      field: "name",
      flex: 1.8,
      minWidth: 150,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: p.data.color }}
          >
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">{p.data.name}</div>
            {p.data.nameEn && <div className="truncate text-[11px] text-muted-foreground" dir="ltr">{p.data.nameEn}</div>}
          </div>
        </div>
      ),
    },
    {
      headerName: t("الرمز"),
      field: "code",
      minWidth: 80,
      cellRenderer: (p: any) =>
        p.value ? (
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground shadow-sm ring-1 ring-inset ring-border/60">{p.value}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      headerName: t("الوصف"),
      field: "description",
      flex: 1.5,
      minWidth: 130,
      cellRenderer: (p: any) =>
        p.value ? <span className="line-clamp-1 text-muted-foreground">{p.value}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      headerName: t("المستندات"),
      field: "docs",
      minWidth: 70,
      filter: "agNumberColumnFilter",
      cellRenderer: (p: any) => (
        <span className="tnum inline-flex min-w-8 items-center justify-center rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary shadow-sm ring-1 ring-inset ring-primary/20">
          {p.value}
        </span>
      ),
    },
    {
      headerName: t("الأعضاء"),
      field: "members",
      minWidth: 70,
      filter: "agNumberColumnFilter",
      cellRenderer: (p: any) => (
        <span className="tnum inline-flex min-w-8 items-center justify-center rounded-lg bg-muted px-2 py-1 text-xs font-bold text-foreground shadow-sm ring-1 ring-inset ring-border/60">
          {p.value}
        </span>
      ),
    },
    {
      headerName: "",
      field: "id",
      width: 90,
      sortable: false,
      filter: false,
      cellRenderer: (p: any) => <DeptActions dept={p.data as DeptRow} />,
      pinned: "right",
    },
  ];
}

export function DepartmentsGrid({ rows }: { rows: DeptRow[] }) {
  const { lang } = useLang(); // re-render on language toggle
  // `buildColumns()` calls `t()` to translate each headerName at build time, and
  // `t` reads a module-level store that ESLint cannot see as a dependency. `lang`
  // is therefore a deliberate cache-invalidation key, not a redundant dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columnDefs = useMemo<ColDef<DeptRow>[]>(() => buildColumns(), [lang]);

  return (
    <DataGrid rows={rows} columnDefs={columnDefs} getRowId={(p) => `dept-${p.data.id}`} exportName="departments" height="max(520px, calc(100vh - 200px))" />
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";

function DeptActions({ dept }: { dept: DeptRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      await updateDepartment(fd);
      toast.success(t("تم تحديث القسم"));
      setEditOpen(false);
    } catch {
      toast.error(t("فشل تحديث القسم"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", String(dept.id));
      await deleteDepartment(fd);
      toast.success(t("تم حذف القسم"));
      setDeleteOpen(false);
    } catch {
      toast.error(t("فشل حذف القسم"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1" dir="ltr">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <button
            className="rounded-lg p-1.5 text-muted-foreground shadow-soft transition hover:bg-muted hover:text-foreground hover:shadow-card"
            title={t("تعديل")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("تعديل القسم")}</DialogTitle>
            <DialogDescription>{dept.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3">
            <input type="hidden" name="id" value={dept.id} />
            <input name="name" defaultValue={dept.name} required placeholder={t("اسم القسم")} className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input name="nameEn" defaultValue={dept.nameEn ?? ""} placeholder={t("الاسم (EN)")} className={inputCls} />
              <input name="code" defaultValue={dept.code ?? ""} placeholder={t("الرمز")} className={inputCls} />
            </div>
            <textarea name="description" rows={3} defaultValue={dept.description ?? ""} placeholder={t("وصف القسم")} className={inputCls} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="color" name="color" defaultValue={dept.color} className="h-8 w-12 cursor-pointer rounded border border-border bg-card" />{t("لون تمييز القسم")}</label>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{t("إلغاء")}</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>{saving ? t("جارٍ الحفظ…") : t("حفظ")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <button
            className="rounded-lg p-1.5 text-muted-foreground shadow-soft transition hover:bg-rose-500/10 hover:text-rose-500 hover:shadow-card"
            title={t("حذف")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("حذف القسم")}</DialogTitle>
            <DialogDescription>
              {t("هل أنت متأكد من حذف “{name}”؟ ستنقل مستنداته وأعضاؤه إلى غير مصنّف.", { name: dept.name })}
              {dept.docs > 0 && <span className="mt-1 block font-medium text-rose-500">{t("{n} مستند سيصبح بدون قسم.", { n: dept.docs })}</span>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">{t("إلغاء")}</Button>
            </DialogClose>
            <Button type="button" variant="destructive" disabled={saving} onClick={handleDelete}>
              {saving ? t("جاري الحذف...") : t("حذف القسم")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
