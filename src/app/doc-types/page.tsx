import { Layers } from "lucide-react";
import { db } from "@/db";
import { docTypes, documents } from "@/db/schema";
import { asc, eq, count } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server";
import { PageHeader, Card } from "@/components/ui";
import { CreateDocTypeForm } from "./form";
import { DocTypesList } from "./doc-types-list";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function DocTypesPage() {
  const lang = await getServerLang();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  const rows = await db
    .select({
      type: docTypes,
      docCount: count(documents.id),
    })
    .from(docTypes)
    .leftJoin(documents, eq(documents.docTypeId, docTypes.id))
    .groupBy(docTypes.id)
    .orderBy(asc(docTypes.sortOrder));

  return (
    <div className="animate-fadein page-stack">
      <PageHeader
        title={ts(lang, "تصنيفات المستندات")}
        subtitle={ts(lang, "إدارة أنواع المستندات — الألوان والترتيب")}
        icon={<Layers className="h-5 w-5" />}
      />

      {isAdmin && <CreateDocTypeForm />}

      <DocTypesList
        rows={rows.map((r) => ({
          id: r.type.id,
          name: r.type.name,
          nameEn: r.type.nameEn,
          color: r.type.color,
          sortOrder: r.type.sortOrder,
          docCount: r.docCount,
        }))}
        isAdmin={isAdmin}
      />
    </div>
  );
}
