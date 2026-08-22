import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { signatures, documents } from "@/db/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { getCurrentUser, logAudit, canAccessDocument } from "@/lib/server";

export const dynamic = "force-dynamic";

const MAX_DATA_URL_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const form = await request.formData();
  const documentId = Number(form.get("documentId"));
  const dataUrl = String(form.get("dataUrl") || "");
  const label = String(form.get("label") || "توقيع");

  if (!documentId || !dataUrl) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  // Reject oversized signature payloads before any processing
  if (dataUrl.length > MAX_DATA_URL_SIZE) {
    return NextResponse.json({ error: "حجم التوقيع يتجاوز الحد الأقصى 2 ميجابايت" }, { status: 400 });
  }

  // Verify the user has access to the document before signing
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc) return NextResponse.json({ error: "المستند غير موجود" }, { status: 404 });
  if (doc.deletedAt) return NextResponse.json({ error: "المستند غير موجود" }, { status: 404 });
  if (!canAccessDocument(user, doc)) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  const [row] = await db
    .insert(signatures)
    .values({ documentId, userId: user.id, label, dataUrl })
    .returning({ id: signatures.id });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "signature.create",
    entityType: "document",
    entityId: documentId,
    details: `إضافة توقيق: ${label}`,
  });

  return NextResponse.json({ id: row?.id });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");

  const conds = [sql`1=1`];
  if (documentId) {
    const docId = Number(documentId);
    conds.push(eq(signatures.documentId, docId));
  }

  // Fetch signatures with document access control
  const rows = await db
    .select({
      id: signatures.id,
      documentId: signatures.documentId,
      userId: signatures.userId,
      label: signatures.label,
      dataUrl: signatures.dataUrl,
      createdAt: signatures.createdAt,
    })
    .from(signatures)
    .where(sql.join(conds, sql` AND `))
    .orderBy(desc(signatures.createdAt));

  // Filter by document access — only return signatures for documents the user can access.
  // Single batched query (no N+1): fetch all referenced documents at once.
  const docIds = [...new Set(rows.map((r) => r.documentId))];
  const accessibleIds = new Set<number>();
  if (docIds.length > 0) {
    const docs = await db.select().from(documents).where(inArray(documents.id, docIds));
    for (const doc of docs) {
      if (canAccessDocument(user, doc)) accessibleIds.add(doc.id);
    }
  }
  const accessibleRows = rows.filter((row) => accessibleIds.has(row.documentId));

  return NextResponse.json(accessibleRows);
}
