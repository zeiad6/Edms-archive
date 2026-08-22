import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentTemplates } from "@/db/schema";
import { getCurrentUser } from "@/lib/server";
import { can } from "@/lib/permissions";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const TEMPLATE_STATUSES = ["draft", "active", "archived"] as const;

/** GET /api/templates — returns all active templates sorted by name */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const all = await db
    .select()
    .from(documentTemplates)
    .where(eq(documentTemplates.status, "active"))
    .orderBy(asc(documentTemplates.sortOrder), asc(documentTemplates.name));
  return NextResponse.json(all, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

/** POST /api/templates — create a new template */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "templates.manage")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { name, description, titlePattern, departmentId, folderId, docType, defaultTags } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "اسم القالب مطلوب" }, { status: 400 });
    }

    const [inserted] = await db
      .insert(documentTemplates)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        titlePattern: titlePattern?.trim() || "{{title}}",
        departmentId: departmentId ? Number(departmentId) : null,
        folderId: folderId ? Number(folderId) : null,
        docType: docType?.trim() || null,
        defaultTags: defaultTags?.trim() || null,
        createdById: user.id,
      })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (e) {
    console.error("[templates] POST failed:", e);
    return NextResponse.json({ error: "فشل إنشاء القالب" }, { status: 500 });
  }
}

/** PUT /api/templates — update an existing template */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "templates.manage")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { id, name, description, titlePattern, departmentId, folderId, docType, defaultTags, sortOrder, status } = body;

    if (!id) {
      return NextResponse.json({ error: "معرف القالب مطلوب" }, { status: 400 });
    }

    if (status !== undefined && !TEMPLATE_STATUSES.includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    const existing = await db.select().from(documentTemplates).where(eq(documentTemplates.id, Number(id))).limit(1);
    if (!existing.length) {
      return NextResponse.json({ error: "القالب غير موجود" }, { status: 404 });
    }

    const [updated] = await db
      .update(documentTemplates)
      .set({
        name: name?.trim() ?? undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
        titlePattern: titlePattern?.trim() ?? undefined,
        departmentId: departmentId !== undefined ? (departmentId ? Number(departmentId) : null) : undefined,
        folderId: folderId !== undefined ? (folderId ? Number(folderId) : null) : undefined,
        docType: docType !== undefined ? (docType?.trim() || null) : undefined,
        defaultTags: defaultTags !== undefined ? (defaultTags?.trim() || null) : undefined,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        status: status ?? undefined,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(documentTemplates.id, Number(id)))
      .returning();

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[templates] PUT failed:", e);
    return NextResponse.json({ error: "فشل تحديث القالب" }, { status: 500 });
  }
}

/** DELETE /api/templates — delete a template */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "templates.manage")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const numericId = Number(id);
    if (!id || !Number.isInteger(numericId) || numericId < 1) {
      return NextResponse.json({ error: "معرف القالب مطلوب" }, { status: 400 });
    }

    await db.delete(documentTemplates).where(eq(documentTemplates.id, numericId));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[templates] DELETE failed:", e);
    return NextResponse.json({ error: "فشل حذف القالب" }, { status: 500 });
  }
}
