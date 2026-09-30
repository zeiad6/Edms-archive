import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentTags } from "@/db/schema";
import { inArray, eq, and, sql } from "drizzle-orm";
import { getCurrentUser, logAudit, loadAccessibleDocs } from "@/lib/server";
import { can } from "@/lib/permissions";
import { safeParseJson, bulkActionSchema } from "@/lib/api-schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/documents/bulk
 *
 * Body: { action: "delete" | "status" | "tag", ids: number[], status?: string, tagId?: number }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const parsed = await safeParseJson(req, bulkActionSchema);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { action, ids } = parsed.data;

  // Re-fetch the requested documents and narrow to the ones this user may
  // actually access (same pattern as bulk-download) — the permission check
  // alone is not enough to prevent cross-department access.
  const { accessible, skipped, found } = await loadAccessibleDocs(user, ids);
  if (accessible.length === 0) {
    if (found === 0) {
      return NextResponse.json({ error: "لا توجد مستندات متطابقة" }, { status: 404 });
    }
    return NextResponse.json({ error: "ليس لديك صلاحية لهذه العملية" }, { status: 403 });
  }
  const accessibleIds = accessible.map((d) => d.id);
  const skippedNote = skipped > 0 ? ` (تم تخطي ${skipped} لعدم الصلاحية)` : "";

  try {
    switch (action) {
      // ── Bulk Delete (soft) ──────────────────────────────────
      case "delete": {
        if (!can(user, "documents.delete")) {
          return NextResponse.json({ error: "غير مصرح — المشرف فقط" }, { status: 403 });
        }
        const now = new Date().toISOString();
        await db
          .update(documents)
          .set({ deletedAt: now, deletedById: user.id })
          .where(and(inArray(documents.id, accessibleIds), sql`deleted_at IS NULL`));
        await logAudit({
          userId: user.id,
          userName: user.name,
          action: "document.bulk_delete",
          entityType: "document",
          entityId: 0,
          details: `نقل ${accessibleIds.length} مستند إلى السلة${skippedNote}`,
        });
        return NextResponse.json({ ok: true, count: accessibleIds.length });
      }

      // ── Bulk Status ─────────────────────────────────────────
      case "status": {
        if (!can(user, "documents.update_all")) {
          return NextResponse.json({ error: "غير مصرح — المشرف فقط" }, { status: 403 });
        }
        await db
          .update(documents)
          .set({ status: parsed.data.status })
          .where(and(inArray(documents.id, accessibleIds), sql`deleted_at IS NULL`));
        await logAudit({
          userId: user.id,
          userName: user.name,
          action: "document.bulk_status",
          entityType: "document",
          entityId: 0,
          details: `تغيير حالة ${accessibleIds.length} مستند إلى "${parsed.data.status}"${skippedNote}`,
        });
        return NextResponse.json({ ok: true, count: accessibleIds.length });
      }

      // ── Bulk Tag ────────────────────────────────────────────
      case "tag": {
        if (!can(user, "documents.update_all")) {
          return NextResponse.json({ error: "غير مصرح — المشرف فقط" }, { status: 403 });
        }
        const tagId = parsed.data.tagId;
        const existing = await db
          .select({ documentId: documentTags.documentId })
          .from(documentTags)
          .where(and(inArray(documentTags.documentId, accessibleIds), eq(documentTags.tagId, tagId)));
        const existingSet = new Set(existing.map((r) => r.documentId));
        const toInsert = accessibleIds.filter((id) => !existingSet.has(id));
        if (toInsert.length > 0) {
          await db.insert(documentTags).values(toInsert.map((documentId) => ({ documentId, tagId })));
        }
        await logAudit({
          userId: user.id,
          userName: user.name,
          action: "document.bulk_tag",
          entityType: "document",
          entityId: 0,
          details: `إضافة وسم #${tagId} إلى ${toInsert.length} مستند${skippedNote}`,
        });
        return NextResponse.json({ ok: true, inserted: toInsert.length });
      }

      default:
        return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
    }
  } catch (e) {
    console.error("Bulk operation error:", e);
    return NextResponse.json({ error: "فشلت العملية" }, { status: 500 });
  }
}
