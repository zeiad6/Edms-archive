import { FolderTree, FolderClosed, Files, Layers } from "lucide-react";
import { db } from "@/db";
import { folders, departments, documents } from "@/db/schema";
import { eq, sql, asc } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { FolderTree as FolderTreeView, type FolderNode } from "@/components/folder-tree";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function FoldersPage() {
  const lang = await getServerLang();
  const rows = await db
    .select({
      id: folders.id,
      name: folders.name,
      parentId: folders.parentId,
      deptName: departments.name,
      deptColor: departments.color,
      docCount: sql<number>`count(${documents.id})`,
    })
    .from(folders)
    .leftJoin(departments, eq(folders.departmentId, departments.id))
    .leftJoin(documents, eq(documents.folderId, folders.id))
    .groupBy(folders.id, folders.name, folders.parentId, departments.name, departments.color)
    .orderBy(asc(folders.name));

  const nodes: FolderNode[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parentId,
    deptName: r.deptName,
    deptColor: r.deptColor,
    docCount: r.docCount,
  }));

  const totalDocs = nodes.reduce((s, n) => s + n.docCount, 0);
  const rootCount = nodes.filter((n) => n.parentId === null).length;

  return (
    <div className="animate-fadein page-stack">
      <PageHeader
        title={ts(lang, "المجلدات")}
        subtitle={ts(lang, "تصفّح الهيكل الهرمي للأرشيف وانتقل إلى مستندات كل مجلد")}
        icon={<FolderTree className="h-5 w-5" />}
      />

      <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-5">
        <Card interactive className="flex items-center gap-3.5 p-5 sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400">
            <FolderClosed className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="tnum text-2xl font-extrabold tracking-tight text-foreground">{nodes.length}</div>
            <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{ts(lang, "مجلد")}</div>
          </div>
        </Card>
        <Card interactive className="flex items-center gap-3.5 p-5 sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">
            <Files className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="tnum text-2xl font-extrabold tracking-tight text-foreground">{totalDocs}</div>
            <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{ts(lang, "مستند مُصنّف")}</div>
          </div>
        </Card>
        <Card interactive className="col-span-2 flex items-center gap-3.5 p-5 sm:col-span-1 sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
            <Layers className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="tnum text-2xl font-extrabold tracking-tight text-foreground">{rootCount}</div>
            <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{ts(lang, "مجلدات رئيسية")}</div>
          </div>
        </Card>
      </div>

      <Card className="p-5 shadow-card sm:p-6 lg:p-7">
        <h3 className="section-title">{ts(lang, "شجرة الأرشيف")}</h3>
        <p className="section-sub mb-5">{ts(lang, "اضغط على أي مجلد لعرض مستنداته. وسّع/اطوِ المجلدات الفرعية بالسهم.")}</p>
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
            <FolderClosed className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">{ts(lang, "لا توجد مجلدات بعد")}</p>
            <p className="text-xs text-muted-foreground/70">{ts(lang, "أنشئ مجلدات من صفحة إضافة مستند أو من إدارة الأرشيف")}</p>
          </div>
        ) : (
          <FolderTreeView folders={nodes} />
        )}
      </Card>
    </div>
  );
}
