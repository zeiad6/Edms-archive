import { Tags, Plus } from "lucide-react";
import { db } from "@/db";
import { tags, documentTags } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createTag } from "@/actions/tags";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { TagsList } from "./tags-list";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const lang = await getServerLang();
  const user = await getCurrentUser();
  if (!user || !can(user, "tags.manage")) redirect("/");

  const allTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      docCount: sql<number>`count(${documentTags.tagId})`,
    })
    .from(tags)
    .leftJoin(documentTags, eq(documentTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(tags.name);

  return (
    <div className="animate-fadein page-stack">
      {/* Page Header */}
      <div className="flex items-start gap-3.5">
        <span className="icon-tile h-12 w-12"><Tags className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="text-balance text-[1.65rem] font-extrabold leading-snug tracking-tight text-foreground">{ts(lang, "إدارة الوسوم")}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{ts(lang, "أنشئ وحرّر واحذف الوسوم المستخدمة في تصنيف المستندات")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6 xl:grid-cols-4">
        {/* Tag list */}
        <div className="md:col-span-2 xl:col-span-3">
          <TagsList tags={allTags} />
        </div>

        {/* Add new tag form */}
        <div className="h-fit rounded-2xl border border-border bg-card p-5 shadow-card ring-1 ring-inset ring-black/[0.03] dark:ring-white/[0.04] sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="icon-tile h-8 w-8 rounded-xl"><Plus className="h-4 w-4" /></span>{ts(lang, "وسم جديد")}</h3>
          <form action={createTag} className="space-y-3.5">
            <input
              name="name"
              required
              placeholder={ts(lang, "اسم الوسم (مثال: مالية، عقود)")}
              className={inputCls}
            />
            <label className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5 text-xs font-medium text-muted-foreground">
              <input
                type="color"
                name="color"
                defaultValue="#64748b"
                className="h-8 w-12 cursor-pointer rounded-lg border border-border bg-card shadow-sm"
              />{ts(lang, "لون الوسم")}</label>
            <button
              type="submit"
              className="h-10 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all duration-150 hover:-translate-y-px hover:bg-primary/90 hover:shadow-lg active:scale-[0.99]"
            >{ts(lang, "إضافة الوسم")}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground shadow-sm outline-none transition-all duration-150 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20";
