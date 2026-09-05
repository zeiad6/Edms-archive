"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import { useState } from "react";
import { Search, X, Hash, Save, Trash2 } from "lucide-react";
import { updateTag, deleteTag } from "@/actions/tags";
import { cn } from "@/lib/format";

interface TagItem {
  id: number;
  name: string;
  color: string;
  docCount: number;
}

export function TagsList({ tags }: { tags: TagItem[] }) {
  useLang(); // re-render on language toggle
  const [q, setQ] = useState("");

  const filtered = q
    ? tags.filter((t) => t.name.includes(q))
    : tags;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* Header with count + search */}
      <div className="border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="tnum inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary shadow-soft ring-1 ring-inset ring-primary/20">
            <Hash className="h-3.5 w-3.5" />
            {t("{a} / {b} وسم", { a: filtered.length, b: tags.length })}
          </span>

          {tags.length > 5 && (
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("بحث في الوسوم...")}
              className="h-10 w-full rounded-xl border border-border bg-muted ps-9 pe-8 text-sm text-foreground shadow-soft outline-none transition hover:border-primary/30 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label={t("مسح")}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          {q ? (
            <>
              <Search className="mb-3 h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">{t("لا توجد نتائج")}</p>
              <p className="mt-1 text-xs">{t("حاول بكلمة بحث مختلفة")}</p>
            </>
          ) : (
            <>
              <Hash className="mb-3 h-12 w-12 opacity-20" />
              <p className="text-sm font-medium">{t("لا توجد وسوم بعد")}</p>
              <p className="mt-1 text-xs">{t("أضف وسماً جديداً ليظهر هنا")}</p>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Inline edit row ───────────────────────────────────────── */

function TagRow({
  tag,
}: {
  tag: { id: number; name: string; color: string; docCount: number };
}) {
  return (
    <div className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-muted/30">
      <span
        className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900"
        style={{ backgroundColor: tag.color }}
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{tag.name}</div>
        <div className="tnum text-[11px] text-muted-foreground">
          {t("{n} مستند", { n: tag.docCount })}
        </div>
      </div>

      <form action={updateTag} className="flex items-center gap-2">
        <input type="hidden" name="id" value={tag.id} />
        <input
          name="name"
          defaultValue={tag.name}
          required
          className={cn(
            "w-28 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-foreground outline-none transition",
            "focus:border-border focus:bg-muted"
          )}
        />
        <input
          type="color"
          name="color"
          defaultValue={tag.color}
          className="h-7 w-10 cursor-pointer rounded border border-border bg-card"
        />
        <button
          type="submit"
          className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
          title={t("حفظ")}
        >
          <Save className="h-4 w-4" />
        </button>
      </form>

      <form action={deleteTag}>
        <input type="hidden" name="id" value={tag.id} />
        <button
          type="submit"
          className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 group-hover:opacity-100"
          title={t("حذف")}
          onClick={(e: any) => {
            if (!confirm(t("حذف الوسم “{n}” نهائياً؟", { n: tag.name }))) e.preventDefault();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
