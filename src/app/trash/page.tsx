import { AlertTriangle } from "lucide-react";
import { db } from "@/db";
import { documents, docTypes } from "@/db/schema";
import { desc, sql, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import TrashClient from "@/components/trash-client";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const user = await getCurrentUser();
  if (!user || !can(user, "trash.view")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/10">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-foreground">لا تملك صلاحية الوصول</h2>
        <p className="mt-1 text-sm text-muted-foreground">سلة المحذوفات متاحة فقط للمسؤولين.</p>
      </div>
    );
  }

  // totalCount was a duplicate of deletedDocs.length (same WHERE, no LIMIT) — removed.
  // The row query is bounded to the newest 200 deletions.
  const [deletedDocs, allDocTypes] = await Promise.all([
    db
      .select({
        id: documents.id,
        title: documents.title,
        docNumber: documents.docNumber,
        docType: documents.docType,
        mimeType: documents.mimeType,
        fileSize: documents.fileSize,
        deletedAt: documents.deletedAt,
        fileName: documents.fileName,
        originalName: documents.originalName,
      })
      .from(documents)
      .where(sql`${documents.deletedAt} IS NOT NULL`)
      .orderBy(desc(sql`${documents.deletedAt}`))
      .limit(200),
    db
      .select({ name: docTypes.name })
      .from(docTypes)
      .orderBy(asc(docTypes.sortOrder))
      .then((r) => r.map((d) => d.name)),
  ]);

  return (
    <div className="animate-fadein">
      <PageHeader
        icon={<AlertTriangle className="h-5 w-5" />}
        title="سلة المحذوفات"
        subtitle="المستندات المحذوفة مؤقتاً — يمكن استعادتها أو حذفها نهائياً."
      />
      <TrashClient deletedDocs={deletedDocs} totalCount={deletedDocs.length} docTypes={allDocTypes} />
    </div>
  );
}
