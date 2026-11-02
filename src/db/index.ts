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

// How long a write waits for another process holding the SQLite lock (a
// backup/restore, an external sqlite3 shell) before failing with
// SQLITE_BUSY. The SQLite default is 0: fail immediately.
const BUSY_TIMEOUT_MS = 5000;

/**
 * Settings SQLite does not store in the database file: every new connection
 * starts with foreign_keys OFF and busy_timeout 0, so they belong next to the
 * connection, not in the seed/DDL path. `journal_mode` is persisted in the
 * file, but re-issuing it keeps a database restored from a non-WAL source
 * (older backup, sqlite3 .dump) in WAL mode before the first write.
 *
 * `db.transaction()` is deliberately avoided in this codebase: libsql hands
 * the shared connection to the transaction and lazily opens a FRESH one for
 * every later query, which drops foreign_keys and busy_timeout. Use
 * `db.batch()` for atomic writes, or call `applyConnectionPragmas()` once the
 * transaction has finished.
 */
const CONNECTION_PRAGMAS = [
  "PRAGMA foreign_keys = ON;",
  `PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`,
  "PRAGMA journal_mode = WAL;",
] as const;

/**
 * Apply the connection settings to the shared connection. Safe to call again
 * after a transaction. A failure is logged, never thrown: a read-only or
 * exotic database must not stop the app from booting, and every caller
 * already tolerates a missing feature (FKs off is the SQLite default).
 */
export async function applyConnectionPragmas(): Promise<void> {
  for (const pragma of CONNECTION_PRAGMAS) {
    try {
      await client.execute(pragma);
    } catch (err) {
      console.error(`[db] ${pragma} failed:`, err);
    }
  }
}

/**
 * Resolves once the shared connection is configured. The work starts at module
 * evaluation — libsql's local client runs each PRAGMA synchronously on the
 * connection before returning, so no query can slip in between — and `dbReady`
 * exists for the code that must not proceed on an unconfigured connection:
 * boot seeding, maintenance jobs, and tests.
 */
export const dbReady: Promise<void> = applyConnectionPragmas();

export const db = drizzle(client);
