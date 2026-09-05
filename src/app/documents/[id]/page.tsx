import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { getCurrentUser, canAccessDocument } from "@/lib/server";
import { can } from "@/lib/permissions";
import { ensureSeeded } from "@/lib/seed";
import { getDocumentRow, getDocumentDetailData } from "@/lib/document-detail";
import { Card, PageHeader } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DocDetailClient } from "@/components/doc-viewer";
import { SignaturesSection } from "@/components/signature/signatures-section";
import { AccessDenied } from "@/components/documents/access-denied";
import { DocumentSidebar } from "@/components/documents/document-sidebar";
import { VersionsTabContent } from "@/components/documents/versions-tab-content";
import { ApprovalsTabContent } from "@/components/documents/approvals-tab-content";
import { AuditTabContent } from "@/components/documents/audit-tab-content";
import { EditTabContent } from "@/components/documents/edit-tab-content";
import { DocumentPreviewCard } from "@/components/documents/document-preview-card";
import { DocumentDescriptionCard } from "@/components/documents/document-description-card";
import { OcrCard } from "@/components/documents/ocr-card";
import { DocumentTagsCard } from "@/components/documents/document-tags-card";
import { ts } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export const dynamic = "force-dynamic";

export default async function DocumentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const lang = await getServerLang();
  await ensureSeeded();
  const { id } = await params;
  const docId = Number(id);
  const user = await getCurrentUser();

  const row = await getDocumentRow(docId);
  const doc = row?.d;
  if (!doc) notFound();

  if (!user || !canAccessDocument(user, doc)) {
    return <AccessDenied />;
  }

  const meta = row;
  const canWrite =
    user!.role === "admin" || user!.role === "manager" || doc.uploadedById === user!.id;
  const canRequestApproval = can(user, "approvals.manage") || doc.uploadedById === user.id;

  const {
    docApprovals,
    approvers,
    tagRows,
    versions,
    docAudit,
    allDepts,
    allFolders,
    allDocTypes,
  } = await getDocumentDetailData(docId);

  return (
    <div className="animate-fadein page-stack">
      <Link
        href="/documents"
        className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowRight className="h-4 w-4" />{ts(lang, "رجوع إلى المستندات")}</Link>

      <PageHeader
        title={doc.title}
        subtitle={
          meta.deptName ? `${meta.deptName} · ${doc.docNumber ?? ts(lang, "بدون رقم")}` : (doc.docNumber ?? "")
        }
        icon={<FileText className="h-5 w-5" />}
        actions={
          <DocDetailClient
            id={doc.id}
            mime={doc.mimeType}
            ext={doc.fileExt}
            title={doc.title}
            isAdmin={can(user, "documents.update_all")}
          />
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6 xl:grid-cols-4">
        {/* Main */}
        <div className="space-y-5 md:col-span-2 lg:space-y-6 xl:col-span-3">
          <DocumentPreviewCard doc={doc} meta={meta} />
          <DocumentDescriptionCard doc={doc} />
          <OcrCard doc={doc} />
          <DocumentTagsCard tagRows={tagRows} />
        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:space-y-6">
          <DocumentSidebar doc={doc} meta={meta} />

          <Card className="p-5 shadow-card">
            <Tabs defaultValue="versions">
              <TabsList>
                <TabsTrigger value="versions">{ts(lang, "الإصدارات")}</TabsTrigger>
                <TabsTrigger value="approvals">{ts(lang, "الموافقات")}</TabsTrigger>
                <TabsTrigger value="signatures">{ts(lang, "التوقيعات")}</TabsTrigger>
                <TabsTrigger value="audit">{ts(lang, "السجل")}</TabsTrigger>
                {canWrite && <TabsTrigger value="edit">{ts(lang, "تعديل")}</TabsTrigger>}
              </TabsList>

              <TabsContent value="versions">
                <VersionsTabContent
                  versions={versions}
                  docId={doc.id}
                  canWrite={canWrite}
                  currentVersion={doc.version}
                />
              </TabsContent>

              <TabsContent value="approvals">
                <ApprovalsTabContent
                  docApprovals={docApprovals}
                  approvers={approvers}
                  canRequest={canRequestApproval}
                  docId={doc.id}
                />
              </TabsContent>

              <TabsContent value="signatures">
                <SignaturesSection documentId={doc.id} />
              </TabsContent>

              <TabsContent value="audit">
                <AuditTabContent docAudit={docAudit} />
              </TabsContent>

              {canWrite && (
                <TabsContent value="edit">
                  <EditTabContent
                    doc={doc}
                    allDepts={allDepts}
                    allFolders={allFolders}
                    allDocTypes={allDocTypes}
                  />
                </TabsContent>
              )}
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
