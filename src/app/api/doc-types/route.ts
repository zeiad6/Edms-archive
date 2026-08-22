import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { docTypes } from "@/db/schema";
import { getCurrentUser, logAudit } from "@/lib/server";
import { can } from "@/lib/permissions";
import { asc, eq } from "drizzle-orm";
import {
  safeParseJson,
  createDocTypeSchema,
  updateDocTypeSchema,
  deleteDocTypeSchema,
} from "@/lib/api-schemas";

export const dynamic = "force-dynamic";

/** GET /api/doc-types — returns all doc types sorted by sortOrder */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const all = await db
    .select()
    .from(docTypes)
    .orderBy(asc(docTypes.sortOrder), asc(docTypes.name));
  return NextResponse.json(all, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

/** POST /api/doc-types — create */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "doc-types.manage")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  const parsed = await safeParseJson(req, createDocTypeSchema);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const [row] = await db
    .insert(docTypes)
    .values({
      name: parsed.data.name.trim(),
      nameEn: parsed.data.nameEn?.trim() || null,
      color: parsed.data.color || "#64748b",
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "doctype.create",
    entityType: "doc_type",
    entityId: row.id,
    details: `إنشاء تصنيف: ${row.name}`,
  });
  return NextResponse.json(row);
}

/** DELETE /api/doc-types — body: { name } or ?name=XXX */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "doc-types.manage")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  // Prefer query param, fall back to JSON body
  let name = req.nextUrl.searchParams.get("name");
  if (!name) {
    const parsed = await safeParseJson(req, deleteDocTypeSchema);
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });
    name = parsed.data.name;
  }
  name = name.trim();
  if (!name) {
    return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  }

  const [existing] = await db.select().from(docTypes).where(eq(docTypes.name, name)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });
  }

  await db.delete(docTypes).where(eq(docTypes.id, existing.id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "doctype.delete",
    entityType: "doc_type",
    entityId: existing.id,
    details: `حذف تصنيف: ${existing.name}`,
  });
  return NextResponse.json({ ok: true });
}

/** PATCH /api/doc-types — update name / nameEn / color / sortOrder by id */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "doc-types.manage")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  const parsed = await safeParseJson(req, updateDocTypeSchema);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;

  const updates: Record<string, unknown> = {};
  if (d.name?.trim()) updates.name = d.name.trim();
  if (d.nameEn !== undefined) updates.nameEn = d.nameEn?.trim() || null;
  if (d.color) updates.color = d.color;
  if (d.sortOrder !== undefined) updates.sortOrder = d.sortOrder;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "لا توجد تغييرات" }, { status: 400 });
  }

  const [existing] = await db.select().from(docTypes).where(eq(docTypes.id, d.id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 404 });
  }

  await db.update(docTypes).set(updates).where(eq(docTypes.id, d.id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "doctype.update",
    entityType: "doc_type",
    entityId: d.id,
    details: `تحديث تصنيف: ${d.name || ""}`,
  });
  return NextResponse.json({ ok: true });
}
