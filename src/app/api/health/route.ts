import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

let seedPromise: Promise<void> | null = null;

/** Run ensureSeeded exactly once per process; retry on next request if it fails. */
function ensureSeededOnce(): Promise<void> {
  if (!seedPromise) {
    seedPromise = ensureSeeded().catch((err) => {
      seedPromise = null; // allow a later request to retry
      throw err;
    });
  }
  return seedPromise;
}

export async function GET() {
  try {
    await db.run(sql`select 1`);
    await ensureSeededOnce();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
