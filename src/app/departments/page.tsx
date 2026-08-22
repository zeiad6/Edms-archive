import { Building2, Plus, Files, Users as UsersIcon, Pencil, Trash2 } from "lucide-react";
import { db } from "@/db";
import { departments, documents, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createDepartment } from "@/actions/departments";
import { Card, PageHeader } from "@/components/ui";
import { DepartmentsGrid } from "@/components/grids/departments-grid";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
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
    <div className="animate-fadein">
      <PageHeader
        title="الأقسام"
        subtitle="تصنيف المستندات والمستخدمين حسب القسم الإداري"
        icon={<Building2 className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <DepartmentsGrid rows={depts} />
        </div>

        <Card className="h-fit p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
            <Plus className="h-4 w-4 text-primary" /> قسم جديد
          </h3>
          <form action={createDepartment} className="space-y-3">
            <input name="name" required placeholder="اسم القسم" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input name="nameEn" placeholder="الاسم (EN)" className={inputCls} />
              <input name="code" placeholder="الرمز" className={inputCls} />
            </div>
            <textarea name="description" rows={3} placeholder="وصف القسم" className={inputCls} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="color" name="color" defaultValue="#4f46e5" className="h-8 w-12 cursor-pointer rounded border border-border bg-card" />
              لون تمييز القسم
            </label>
            <button type="submit" className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              إضافة القسم
            </button>
          </form>
          <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Files className="h-3.5 w-3.5" /> {totalDocs} مستند</span>
            <span className="inline-flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> {totalMembers} عضو</span>
          </div>
        </Card>
      </div>

    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";
