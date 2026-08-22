import { NextResponse } from "next/server";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { getCurrentUser } from "@/lib/server";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/tags — returns all tags sorted by name */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const all = await db.select().from(tags).orderBy(asc(tags.name));
  return NextResponse.json(all, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
