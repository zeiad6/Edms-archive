import { Users as UsersIcon, Plus, FileText } from "lucide-react";
import { db } from "@/db";
import { users, departments, documents } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Card, PageHeader } from "@/components/ui";
import { UsersPageClient } from "@/components/users/users-page-client";
import { UserCreateForm } from "@/components/users/user-create-form";
import type { UserRow } from "@/components/users/user-row";
import { getCurrentUser } from "@/lib/server";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const lang = await getServerLang();
  const currentUser = await getCurrentUser();
  const [list, depts] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        role: users.role,
        jobTitle: users.jobTitle,
        avatarColor: users.avatarColor,
        createdAt: users.createdAt,
        deptName: departments.name,
        docs: sql<number>`CAST(count(${documents.id}) AS INTEGER)`,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .leftJoin(documents, eq(documents.uploadedById, users.id))
      .groupBy(users.id, departments.name)
      .orderBy(desc(users.createdAt)),
    db.select({ id: departments.id, name: departments.name }).from(departments),
  ]);

  const rows: UserRow[] = list.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    jobTitle: u.jobTitle,
    avatarColor: u.avatarColor,
    deptName: u.deptName,
    docs: u.docs,
    joined: typeof u.createdAt === "string" ? u.createdAt : new Date(u.createdAt).toISOString(),
  }));

  return (
    <div className="animate-fadein page-stack">
      <PageHeader
        title={ts(lang, "المستخدمون")}
        subtitle={ts(lang, "إدارة المشغّلين وأدوارهم وصلاحياتهم")}
        icon={<UsersIcon className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6 xl:grid-cols-4">
        <div className="md:col-span-2 xl:col-span-3">
          <UsersPageClient rows={rows} departments={depts} currentUserId={currentUser?.id} />
        </div>

        <Card className="h-fit p-5 shadow-card sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="icon-tile h-8 w-8 rounded-xl"><Plus className="h-4 w-4" /></span>{ts(lang, "مستخدم جديد")}</h3>
          <UserCreateForm departments={depts} />
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{ts(lang, "الأدوار: مدير النظام (وصول كامل)، مشرف قسم (يدير قسمه)، موظف (وصول مقيد ويستثنى السري).")}</p>
        </Card>
      </div>
    </div>
  );
}
