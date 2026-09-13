import { db } from "../src/db/index.ts";
import { sql } from "drizzle-orm";
import { ensureSeeded } from "../src/lib/seed.ts";

(async () => {
  await ensureSeeded();
  const r = await db.all(sql`SELECT
    (SELECT COUNT(*) FROM departments) d,
    (SELECT COUNT(*) FROM users) u,
    (SELECT COUNT(*) FROM documents) doc,
    (SELECT COUNT(*) FROM folders) f,
    (SELECT COUNT(*) FROM tags) t,
    (SELECT COUNT(*) FROM doc_types) dt,
    (SELECT COUNT(*) FROM document_templates) tmp`);
  console.log(JSON.stringify(r[0]));
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
