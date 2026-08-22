"use client";

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

/** Static column definitions — module scope so AG Grid keeps stable identity across renders. */
const BASE_COLUMNS: ColDef<DeptRow>[] = [
    {
      headerName: "القسم",
      field: "name",
      flex: 1.8,
      minWidth: 150,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
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
      headerName: "الرمز",
      field: "code",
      minWidth: 80,
      cellRenderer: (p: any) =>
        p.value ? (
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{p.value}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      headerName: "الوصف",
      field: "description",
      flex: 1.5,
      minWidth: 130,
      cellRenderer: (p: any) =>
        p.value ? <span className="line-clamp-1 text-muted-foreground">{p.value}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      headerName: "المستندات",
      field: "docs",
      minWidth: 70,
      filter: "agNumberColumnFilter",
      cellRenderer: (p: any) => (
        <span className="tnum inline-flex items-center justify-center rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
          {p.value}
        </span>
      ),
    },
    {
      headerName: "الأعضاء",
      field: "members",
      minWidth: 70,
      filter: "agNumberColumnFilter",
      cellRenderer: (p: any) => (
        <span className="tnum inline-flex items-center justify-center rounded-lg bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
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

export function DepartmentsGrid({ rows }: { rows: DeptRow[] }) {
  const columnDefs = useMemo<ColDef<DeptRow>[]>(() => BASE_COLUMNS, []);

  return (
    <DataGrid rows={rows} columnDefs={columnDefs} getRowId={(p) => `dept-${p.data.id}`} exportName="departments" height="max(520px, calc(100vh - 200px))" />
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";

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
      toast.success("تم تحديث القسم");
      setEditOpen(false);
    } catch {
      toast.error("فشل تحديث القسم");
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
      toast.success("تم حذف القسم");
      setDeleteOpen(false);
    } catch {
      toast.error("فشل حذف القسم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1" dir="ltr">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <button
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="تعديل"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل القسم</DialogTitle>
            <DialogDescription>{dept.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3">
            <input type="hidden" name="id" value={dept.id} />
            <input name="name" defaultValue={dept.name} required placeholder="اسم القسم" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input name="nameEn" defaultValue={dept.nameEn ?? ""} placeholder="الاسم (EN)" className={inputCls} />
              <input name="code" defaultValue={dept.code ?? ""} placeholder="الرمز" className={inputCls} />
            </div>
            <textarea name="description" rows={3} defaultValue={dept.description ?? ""} placeholder="وصف القسم" className={inputCls} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="color" name="color" defaultValue={dept.color} className="h-8 w-12 cursor-pointer rounded border border-border bg-card" />
              لون تمييز القسم
            </label>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">إلغاء</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <button
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-500"
            title="حذف"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف القسم</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف &quot;{dept.name}&quot؟ ستنقل مستنداته وأعضاؤه إلى غير مصنّف.
              {dept.docs > 0 && <span className="mt-1 block text-rose-500">{dept.docs} مستند سيصبح بدون قسم.</span>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">إلغاء</Button>
            </DialogClose>
            <Button type="button" variant="destructive" disabled={saving} onClick={handleDelete}>
              {saving ? "جاري الحذف..." : "حذف القسم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
