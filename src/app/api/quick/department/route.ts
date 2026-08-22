import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, logAudit } from "@/lib/server";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** GET /api/quick/department — list all departments */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const all = await db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(departments.name);
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
  if (!user || !can(user, "departments.manage")) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  if (!name) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });

  // Reject duplicate department names so the picker never shows duplicates.
  const existing = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.name, name))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "اسم القسم موجود مسبقاً" }, { status: 409 });
  }

  const colors = ["#4f46e5", "#059669", "#d97706", "#0ea5e9", "#be123c", "#7c3aed", "#6366f1"];
  const color = colors[randomInt(colors.length)];
  const [row] = await db.insert(departments).values({ name, color }).returning({ id: departments.id });
  await logAudit({ userId: user.id, userName: user.name, action: "department.create", entityType: "department", entityId: row?.id, details: `إنشاء قسم: ${name}` });
  return NextResponse.json({ id: row?.id });
}
