import { Tags, Plus } from "lucide-react";
import { db } from "@/db";
import { tags, documentTags } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createTag } from "@/actions/tags";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { TagsList } from "./tags-list";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
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
    <div className="animate-fadein space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Tags className="h-6 w-6 text-primary" />
          إدارة الوسوم
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          أنشئ وحرّر واحذف الوسوم المستخدمة في تصنيف المستندات
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Tag list */}
        <div className="md:col-span-2">
          <TagsList tags={allTags} />
        </div>

        {/* Add new tag form */}
        <div className="h-fit rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            وسم جديد
          </h3>
          <form action={createTag} className="space-y-3">
            <input
              name="name"
              required
              placeholder="اسم الوسم (مثال: مالية، عقود)"
              className={inputCls}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="color"
                name="color"
                defaultValue="#64748b"
                className="h-8 w-12 cursor-pointer rounded border border-border bg-card"
              />
              لون الوسم
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              إضافة الوسم
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";
