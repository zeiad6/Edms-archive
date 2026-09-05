"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateDocTypeForm() {
  useLang(); // re-render on language toggle
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
        alert(t(err.error || "فشل الإنشاء"));
        return;
      }
      r.refresh();
      setOpen(false);
    } catch {
      alert(t("حدث خطأ غير متوقع"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:-translate-y-px hover:opacity-90 hover:shadow-lg active:translate-y-0"
        >
          <Plus className="h-4 w-4" />{t("إضافة تصنيف جديد")}</button>
      ) : (
        <Card className="card-sheen p-4 sm:p-5 shadow-card">
          <form onSubmit={handle} className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("الاسم")}</label>
              <input
                name="name"
                required
                className="h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("إنجليزي")}</label>
              <input
                name="nameEn"
                className="h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="w-20">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("اللون")}</label>
              <input
                name="color"
                type="color"
                defaultValue="#6366f1"
                className="h-10 w-full cursor-pointer rounded-xl border border-border bg-muted p-1 shadow-soft"
              />
            </div>
            <div className="w-20">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("الترتيب")}</label>
              <input
                name="sortOrder"
                type="number"
                defaultValue={0}
                className="h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:-translate-y-px hover:opacity-90 hover:shadow-lg active:translate-y-0 disabled:opacity-50"
              >
                {busy ? "..." : t("حفظ")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-xl border border-border px-4 text-sm text-muted-foreground shadow-soft transition hover:bg-muted hover:text-foreground"
              >{t("إلغاء")}</button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export function DeleteDocTypeButton({ name }: { name: string }) {
  useLang(); // re-render on language toggle
  const r = useRouter();
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!confirm(t("حذف التصنيف “{n}”؟", { n: name }))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/doc-types", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(t(err.error || "فشل الحذف"));
        return;
      }
      r.refresh();
    } catch {
      alert(t("حدث خطأ غير متوقع"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="rounded-lg p-1.5 text-muted-foreground shadow-soft transition hover:bg-rose-500/10 hover:text-rose-500 hover:shadow-card disabled:opacity-50"
      title={t("حذف")}
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
  useLang(); // re-render on language toggle
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
        alert(t(err.error || "فشل التحديث"));
        return;
      }
      r.refresh();
      setEditing(false);
    } catch {
      alert(t("حدث خطأ غير متوقع"));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg p-1 text-xs text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        title={t("تعديل")}
      >{t("تعديل")}</button>
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
        title={t("حفظ")}
      >
        {busy ? <span className="text-xs">...</span> : <Save className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg p-1 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-500"
        title={t("إلغاء")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card shadow-card ${className}`}>{children}</div>;
}
