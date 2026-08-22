import { FolderTree, FolderClosed, Files, Layers } from "lucide-react";
import { db } from "@/db";
import { folders, departments, documents } from "@/db/schema";
import { eq, sql, asc } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { FolderTree as FolderTreeView, type FolderNode } from "@/components/folder-tree";

export const dynamic = "force-dynamic";

export default async function FoldersPage() {
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
    <div className="animate-fadein space-y-6">
      <PageHeader
        title="المجلدات"
        subtitle="تصفّح الهيكل الهرمي للأرشيف وانتقل إلى مستندات كل مجلد"
        icon={<FolderTree className="h-5 w-5" />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <FolderClosed className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-bold text-foreground">{nodes.length}</div>
            <div className="text-xs text-muted-foreground">مجلد</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Files className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-bold text-foreground">{totalDocs}</div>
            <div className="text-xs text-muted-foreground">مستند مُصنّف</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-bold text-foreground">{rootCount}</div>
            <div className="text-xs text-muted-foreground">مجلدات رئيسية</div>
          </div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h3 className="mb-1 text-sm font-bold text-foreground">شجرة الأرشيف</h3>
        <p className="mb-4 text-xs text-muted-foreground">اضغط على أي مجلد لعرض مستنداته. وسّع/اطوِ المجلدات الفرعية بالسهم.</p>
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-14 text-center">
            <FolderClosed className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">لا توجد مجلدات بعد</p>
            <p className="text-xs text-muted-foreground/70">أنشئ مجلدات من صفحة إضافة مستند أو من إدارة الأرشيف</p>
          </div>
        ) : (
          <FolderTreeView folders={nodes} />
        )}
      </Card>
    </div>
  );
}
