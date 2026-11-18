import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getCurrentUser, canAccessDocument } from "@/lib/server";
import { getDocumentRow, getDocumentDetailData } from "@/lib/document-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/documents/[id]/summary — returns metadata, tags, version history,
 * and approval workflow trail for the Quick Preview Drawer on `/documents`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const docId = Number(id);
  if (!Number.isInteger(docId) || docId <= 0) {
    return NextResponse.json({ error: "معرف مستند غير صالح" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const [rawDoc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  if (!rawDoc || rawDoc.deletedAt) {
    return NextResponse.json({ error: "المستند غير موجود" }, { status: 404 });
  }

  if (!canAccessDocument(user, rawDoc)) {
    return NextResponse.json({ error: "ليس لديك صلاحية للوصول لهذا المستند" }, { status: 403 });
  }

  const [row, detail] = await Promise.all([
    getDocumentRow(docId),
    getDocumentDetailData(docId),
  ]);

  if (!row) {
    return NextResponse.json({ error: "المستند غير موجود" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    document: {
      id: row.d.id,
      title: row.d.title,
      description: row.d.description,
      docNumber: row.d.docNumber,
      docType: row.d.docType,
      status: row.d.status,
      confidential: Boolean(row.d.confidential),
      fileSize: row.d.fileSize,
      fileExt: row.d.fileExt,
      mimeType: row.d.mimeType,
      pageCount: row.d.pageCount,
      version: row.d.version,
      docDate: row.d.docDate,
      keywords: row.d.keywords,
      source: row.d.source,
      createdAt: row.d.createdAt,
      updatedAt: row.d.updatedAt,
      departmentName: row.deptName,
      departmentColor: row.deptColor,
      folderName: row.folderName,
      uploaderName: row.uploaderName,
      ocrSnippet: (row.d.ocrText || row.d.contentText || "").slice(0, 350),
    },
    tags: detail.tagRows.map((t, idx) => ({ id: idx + 1, name: t.name, color: t.color })),
    versions: detail.versions.map((v) => ({
      id: v.v.id,
      version: v.v.version,
      originalName: v.v.originalName,
      fileSize: v.v.fileSize,
      note: v.v.note,
      createdAt: v.v.createdAt,
      uploaderName: v.uploaderName,
    })),
    approvals: detail.docApprovals.map((a) => ({
      id: a.id,
      status: a.status,
      comment: a.comment,
      responseNote: a.responseNote,
      respondedAt: a.respondedAt,
      createdAt: a.createdAt,
      approverName: a.requesterName,
    })),
  });
}
