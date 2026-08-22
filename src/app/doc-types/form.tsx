"use client";

import { useState } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateDocTypeForm() {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/doc-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          nameEn: fd.get("nameEn"),
          color: fd.get("color") || "#64748b",
          sortOrder: Number(fd.get("sortOrder")) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "فشل الإنشاء");
        return;
      }
      r.refresh();
      setOpen(false);
    } catch {
      alert("حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> إضافة تصنيف جديد
        </button>
      ) : (
        <Card className="p-4">
          <form onSubmit={handle} className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">الاسم</label>
              <input
                name="name"
                required
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">إنجليزي</label>
              <input
                name="nameEn"
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>
            <div className="w-20">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">اللون</label>
              <input
                name="color"
                type="color"
                defaultValue="#6366f1"
                className="h-9 w-full cursor-pointer rounded-xl border border-border bg-muted p-1"
              />
            </div>
            <div className="w-20">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">الترتيب</label>
              <input
                name="sortOrder"
                type="number"
                defaultValue={0}
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "..." : "حفظ"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export function DeleteDocTypeButton({ name }: { name: string }) {
  const r = useRouter();
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!confirm(`حذف التصنيف "${name}"؟`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/doc-types", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "فشل الحذف");
        return;
      }
      r.refresh();
    } catch {
      alert("حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
      title="حذف"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

export function InlineEditForm({
  id,
  defaultName,
  defaultColor,
  defaultNameEn,
  defaultSortOrder,
}: {
  id: number;
  defaultName: string;
  defaultColor: string;
  defaultNameEn: string | null;
  defaultSortOrder: number;
}) {
  const r = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/doc-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: fd.get("name"),
          nameEn: fd.get("nameEn"),
          color: fd.get("color"),
          sortOrder: Number(fd.get("sortOrder")),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "فشل التحديث");
        return;
      }
      r.refresh();
      setEditing(false);
    } catch {
      alert("حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg p-1 text-xs text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        title="تعديل"
      >
        تعديل
      </button>
    );
  }

  return (
    <form onSubmit={handle} className="flex items-center gap-2">
      <input name="id" type="hidden" value={id} />
      <input
        name="name"
        defaultValue={defaultName}
        required
        className="w-24 rounded-lg border border-border bg-muted px-2 py-1 text-xs outline-none focus:border-ring"
      />
      <input
        name="nameEn"
        defaultValue={defaultNameEn ?? ""}
        className="w-20 rounded-lg border border-border bg-muted px-2 py-1 text-xs outline-none ltr focus:border-ring"
      />
      <input
        name="color"
        type="color"
        defaultValue={defaultColor}
        className="h-7 w-8 cursor-pointer rounded border border-border bg-card"
      />
      <input
        name="sortOrder"
        type="number"
        defaultValue={defaultSortOrder}
        className="w-14 rounded-lg border border-border bg-muted px-2 py-1 text-xs outline-none focus:border-ring"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary disabled:opacity-50"
        title="حفظ"
      >
        {busy ? <span className="text-xs">...</span> : <Save className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg p-1 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-500"
        title="إلغاء"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card ${className}`}>{children}</div>;
}
