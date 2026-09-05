import { AlertTriangle } from "lucide-react";
import { db } from "@/db";
import { documents, docTypes } from "@/db/schema";
import { desc, sql, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import TrashClient from "@/components/trash-client";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const lang = await getServerLang();
  const user = await getCurrentUser();
  if (!user || !can(user, "trash.view")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="mb-1 flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-600 shadow-card ring-1 ring-inset ring-rose-500/25 dark:text-rose-400">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight text-foreground">{ts(lang, "لا تملك صلاحية الوصول")}</h2>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{ts(lang, "سلة المحذوفات متاحة فقط للمسؤولين.")}</p>
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
    <div className="animate-fadein page-stack">
      <PageHeader
        icon={<AlertTriangle className="h-5 w-5" />}
        title={ts(lang, "سلة المحذوفات")}
        subtitle={ts(lang, "المستندات المحذوفة مؤقتاً — يمكن استعادتها أو حذفها نهائياً.")}
      />
      <TrashClient deletedDocs={deletedDocs} totalCount={deletedDocs.length} docTypes={allDocTypes} />
    </div>
  );
}
