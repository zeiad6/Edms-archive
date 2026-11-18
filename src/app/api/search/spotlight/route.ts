import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/server";
import { searchSpotlightDocuments } from "@/lib/fts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight, protected Spotlight search & admin user-switcher endpoint.
 *
 * - `GET /api/search/spotlight?q=<query>&limit=10`: runs debounced SQLite FTS5
 *   search across `title`, `contentText`, and `docNumber` (`referenceNumber`)
 *   scoped to the caller's RBAC permissions.
 * - `GET /api/search/spotlight?users=1`: returns the user directory ONLY to
 *   authenticated `admin` operators when opening the user-switcher menu.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  if (sp.get("users") === "1") {
    if (user.role !== "admin") {
      return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 403 });
    }
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        jobTitle: users.jobTitle,
        avatarColor: users.avatarColor,
      })
      .from(users);
    return NextResponse.json({ ok: true, users: allUsers });
  }

  const q = sp.get("q") || "";
  const limit = Number(sp.get("limit") || "10");
  const results = await searchSpotlightDocuments(user, q, Number.isFinite(limit) ? limit : 10);

  return NextResponse.json({ ok: true, results });
}
