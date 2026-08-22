import { eq, desc, and, asc, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  documents,
  departments,
  folders,
  users,
  tags,
  documentTags,
  documentVersions,
  auditLogs,
  approvalRequests,
  docTypes,
} from "@/db/schema";

/**
 * Document detail data layer — server-only.
 * `getDocumentRow` returns the document joined with display metadata (department,
 * uploader, folder, doc-type color); `getDocumentDetailData` returns everything
 * the tabs on the detail page need (approvals, versions, audit, tag rows, and the
 * department/folder/doc-type lists used by the edit tab).
 */

export async function getDocumentRow(docId: number) {
  const rows = await db
    .select({
      d: documents,
      deptName: departments.name,
      deptColor: departments.color,
      uploaderName: users.name,
      uploaderColor: users.avatarColor,
      uploaderTitle: users.jobTitle,
      folderName: folders.name,
      docTypeColor: docTypes.color,
    })
    .from(documents)
    .leftJoin(departments, eq(documents.departmentId, departments.id))
    .leftJoin(users, eq(documents.uploadedById, users.id))
    .leftJoin(folders, eq(documents.folderId, folders.id))
    .leftJoin(docTypes, eq(documents.docType, docTypes.name))
    .where(and(eq(documents.id, docId), isNull(documents.deletedAt)))
    .limit(1);

  return rows[0];
}

export async function getDocumentDetailData(docId: number) {
  const [docApprovals, approvers, tagRows, versions, docAudit, allDepts, allFolders, allDocTypes] = await Promise.all([
    db
      .select({
        id: approvalRequests.id,
        status: approvalRequests.status,
        comment: approvalRequests.comment,
        responseNote: approvalRequests.responseNote,
        createdAt: approvalRequests.createdAt,
        respondedAt: approvalRequests.respondedAt,
        requesterName: users.name,
        requesterColor: users.avatarColor,
      })
      .from(approvalRequests)
      .leftJoin(users, eq(approvalRequests.requestedById, users.id))
      .where(eq(approvalRequests.documentId, docId))
      .orderBy(desc(approvalRequests.createdAt)),
    db
      .select({ id: users.id, name: users.name, avatarColor: users.avatarColor, jobTitle: users.jobTitle })
      .from(users)
      .where(sql`${users.role} IN ('admin','manager')`),
    db
      .select({ name: tags.name, color: tags.color })
      .from(documentTags)
      .innerJoin(tags, eq(documentTags.tagId, tags.id))
      .where(eq(documentTags.documentId, docId)),
    db
      .select({ v: documentVersions, uploaderName: users.name })
      .from(documentVersions)
      .leftJoin(users, eq(documentVersions.uploadedById, users.id))
      .where(eq(documentVersions.documentId, docId))
      .orderBy(desc(documentVersions.version)),
    db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "document"), eq(auditLogs.entityId, docId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
    db.select({ id: departments.id, name: departments.name }).from(departments),
    db.select({ id: folders.id, name: folders.name }).from(folders),
    db.select({ id: docTypes.id, name: docTypes.name }).from(docTypes).orderBy(asc(docTypes.sortOrder)),
  ]);

  return { docApprovals, approvers, tagRows, versions, docAudit, allDepts, allFolders, allDocTypes };
}

export type DocumentDetailRow = Awaited<ReturnType<typeof getDocumentRow>>;
export type DocumentDetailData = Awaited<ReturnType<typeof getDocumentDetailData>>;
