import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { departments, folders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, logAudit } from "@/lib/server";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** GET /api/quick/folder — list all folders */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const all = await db.select({ id: folders.id, name: folders.name }).from(folders).orderBy(folders.name);
  return NextResponse.json(all, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "folders.manage")) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  if (!name) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });

  // Department is required so folders are never orphaned: prefer the explicit
  // form field, fall back to the creating user's department, then verify it exists.
  const rawDept = form.get("departmentId");
  const deptId = rawDept ? Number(rawDept) : user.departmentId;
  if (!deptId || !Number.isInteger(deptId) || deptId <= 0) {
    return NextResponse.json({ error: "القسم مطلوب" }, { status: 400 });
  }
  const dept = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.id, deptId))
    .limit(1);
  if (!dept[0]) return NextResponse.json({ error: "القسم غير موجود" }, { status: 400 });

  const [row] = await db.insert(folders).values({ name, departmentId: deptId }).returning({ id: folders.id });
  await logAudit({ userId: user.id, userName: user.name, action: "folder.create", entityType: "folder", entityId: row?.id, details: `إنشاء مجلد: ${name}` });
  return NextResponse.json({ id: row?.id });
}
