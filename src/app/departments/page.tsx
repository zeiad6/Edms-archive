import { Building2, Plus, Files, Users as UsersIcon, Pencil, Trash2 } from "lucide-react";
import { db } from "@/db";
import { departments, documents, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createDepartment } from "@/actions/departments";
import { Card, PageHeader } from "@/components/ui";
import { DepartmentsGrid } from "@/components/grids/departments-grid";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const lang = await getServerLang();
  const depts = await db
    .select({
      id: departments.id,
      name: departments.name,
      nameEn: departments.nameEn,
      code: departments.code,
      description: departments.description,
      color: departments.color,
      docs: sql<number>`count(distinct ${documents.id})`,
      members: sql<number>`count(distinct ${users.id})`,
    })
    .from(departments)
    .leftJoin(documents, eq(documents.departmentId, departments.id))
    .leftJoin(users, eq(users.departmentId, departments.id))
    .groupBy(departments.id)
    .orderBy(departments.name);

  const totalDocs = depts.reduce((s, d) => s + d.docs, 0);
  const totalMembers = depts.reduce((s, d) => s + d.members, 0);

  return (
    <div className="animate-fadein page-stack">
      <PageHeader
        title={ts(lang, "الأقسام")}
        subtitle={ts(lang, "تصنيف المستندات والمستخدمين حسب القسم الإداري")}
        icon={<Building2 className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6 xl:grid-cols-4">
        <div className="md:col-span-2 xl:col-span-3">
          <DepartmentsGrid rows={depts} />
        </div>

        <Card className="h-fit p-5 shadow-card sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="icon-tile h-8 w-8 rounded-xl"><Plus className="h-4 w-4" /></span>{ts(lang, "قسم جديد")}</h3>
          <form action={createDepartment} className="space-y-3.5">
            <input name="name" required placeholder={ts(lang, "اسم القسم")} className={inputCls} />
            <div className="grid grid-cols-2 gap-2.5">
              <input name="nameEn" placeholder={ts(lang, "الاسم (EN)")} className={inputCls} />
              <input name="code" placeholder={ts(lang, "الرمز")} className={inputCls} />
            </div>
            <textarea name="description" rows={3} placeholder={ts(lang, "وصف القسم")} className={inputCls} />
            <label className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5 text-xs font-medium text-muted-foreground">
              <input type="color" name="color" defaultValue="#4f46e5" className="h-8 w-12 cursor-pointer rounded-lg border border-border bg-card shadow-sm" />{ts(lang, "لون تمييز القسم")}</label>
            <button type="submit" className="h-10 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all duration-150 hover:-translate-y-px hover:bg-primary/90 hover:shadow-lg active:scale-[0.99]">{ts(lang, "إضافة القسم")}</button>
          </form>
          <div className="mt-5 flex items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Files className="h-3.5 w-3.5" /> {ts(lang, "{n} مستند", { n: totalDocs })}</span>
            <span className="inline-flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> {ts(lang, "{n} عضو", { n: totalMembers })}</span>
          </div>
        </Card>
      </div>

    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground shadow-sm outline-none transition-all duration-150 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/20";
