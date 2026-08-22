"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/format";

interface ManagedOption {
  id: number;
  name: string;
  color?: string;
}

interface Props {
  label: string;
  options: ManagedOption[];
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  placeholder?: string;
  onCreate?: (name: string) => Promise<{ id: number } | void>;
  onUpdate?: (id: number, name: string) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  allowCreate?: boolean;
  nullable?: boolean;
}

export function ManagedSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "— اختر —",
  onCreate,
  onUpdate,
  onDelete,
  allowCreate = false,
  nullable = true,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [editId, setEditId] = useState<number | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!inputVal.trim() || !onCreate) return;
    setBusy(true);
    try {
      const res = await onCreate(inputVal.trim());
      if (res && "id" in res) onChange(res.id);
      setInputVal("");
      setMode("view");
      toast.success(`تمت إضافة "${inputVal.trim()}"`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشلت الإضافة");
    }
    setBusy(false);
  }

  async function handleUpdate(id: number) {
    if (!inputVal.trim() || !onUpdate) return;
    setBusy(true);
    try {
      await onUpdate(id, inputVal.trim());
      setInputVal("");
      setMode("view");
      setEditId(null);
      toast.success("تم التحديث");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    }
    setBusy(false);
  }

  async function handleDelete(id: number) {
    if (!onDelete) return;
    const name = options.find((o) => o.id === id)?.name ?? id.toString();
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    setBusy(true);
    try {
      await onDelete(id);
      if (value === id) onChange("");
      toast.success(`تم حذف "${name}"`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    }
    setBusy(false);
  }

  const selected = options.find((o) => o.id === value || o.name === value);

  if (mode === "create" && allowCreate) {
    return (
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex gap-1.5">
          <input
            autoFocus
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder={`إضافة ${label} جديد...`}
            className={inputCls}
          />
          <button onClick={handleCreate} disabled={busy || !inputVal.trim()} className="inline-flex h-7 w-7 items-center justify-center rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-500/10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button onClick={() => { setMode("view"); setInputVal(""); }} className="inline-flex h-7 w-7 items-center justify-center rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (mode === "edit" && editId !== null) {
    return (
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex gap-1.5">
          <input
            autoFocus
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUpdate(editId)}
            placeholder={`تعديل ${label}...`}
            className={inputCls}
          />
          <button onClick={() => handleUpdate(editId)} disabled={busy || !inputVal.trim()} className="inline-flex h-7 w-7 items-center justify-center rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-500/10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </button>
          <button onClick={() => { setMode("view"); setEditId(null); setInputVal(""); }} className="inline-flex h-7 w-7 items-center justify-center rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {allowCreate && options.length > 0 && (
          <div className="flex gap-0.5">
              <button
              title={`إضافة ${label}`}
              onClick={() => setMode("create")}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg p-1 text-primary transition hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              title={`تعديل ${label}`}
              onClick={() => {
                if (selected) {
                  setEditId(selected.id as number);
                  setInputVal(selected.name);
                  setMode("edit");
                }
              }}
              disabled={!selected}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg p-1 text-muted-foreground transition hover:bg-muted disabled:opacity-30"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {onDelete && selected && (
              <button
                title={`حذف ${label}`}
                onClick={() => handleDelete(selected.id as number)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg p-1 text-rose-500 transition hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          {nullable && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
        {options.length === 0 && allowCreate && (
          <button
            onClick={() => setMode("create")}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20"
          >
            + إضافة
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";
