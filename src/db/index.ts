import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

const databaseUrl =
  process.env.DATABASE_URL ||
  (process.env.EDMS_DATA_DIR
    ? `file:${process.env.EDMS_DATA_DIR.replace(/\\/g, "/")}/edms.db`
    : "file:./data/edms.db");

const client = createClient({
  url: databaseUrl,
});

export const db = drizzle(client);