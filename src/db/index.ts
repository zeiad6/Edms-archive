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

// Enforce foreign key constraints before any query executes (SQLite defaults
// to OFF). The PRAGMA is awaited inside the async init; failures are logged
// without crashing boot, so the connection never runs queries with FKs off.
async function enableForeignKeys(): Promise<void> {
  try {
    await client.execute("PRAGMA foreign_keys = ON;");
  } catch (err) {
    console.error("[db] PRAGMA foreign_keys failed:", err);
  }
}

void enableForeignKeys();

export const db = drizzle(client);