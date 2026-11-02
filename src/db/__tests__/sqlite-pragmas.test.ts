// @vitest-environment node
// Phase 1 foundation: connection settings are applied once, next to the
// connection, before any query can run. This replaces the old fire-and-forget
// loop (which nothing awaited and the seed path partially duplicated) and
// moves journal_mode out of the DDL code, where it looked like schema
// ownership.
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = mkdtempSync(path.join(tmpdir(), "edms-pragmas-"));
const dbFile = path.join(root, "edms.db").replace(/\\/g, "/");
const walFile = `${dbFile}-wal`;

beforeAll(() => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", `file:${dbFile}`);
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

async function load() {
  const { db, dbReady, applyConnectionPragmas } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  await dbReady;
  return { db, sql, applyConnectionPragmas };
}

describe("SQLite connection settings", () => {
  it("applies foreign_keys, busy_timeout and WAL on a fresh database", async () => {
    const { db, sql } = await load();

    const [fk] = await db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
    expect(fk.foreign_keys).toBe(1);

    const [busy] = await db.all<{ timeout: number }>(sql`PRAGMA busy_timeout`);
    expect(busy.timeout).toBe(5000);

    const [journal] = await db.all<{ journal_mode: string }>(sql`PRAGMA journal_mode`);
    expect(journal.journal_mode).toBe("wal");
  });

  it("enforces foreign keys for real", async () => {
    const { db, sql } = await load();
    await db.run(sql`CREATE TABLE parent (id INTEGER PRIMARY KEY)`);
    await db.run(
      sql`CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id))`,
    );

    // Drizzle wraps the driver error ("Failed query: …"); the SQLite reason
    // is on `cause`, so assert there instead of on the wrapper's message.
    const failure = await db.run(sql`INSERT INTO child (parent_id) VALUES (999)`).then(
      () => null,
      (err: { message: string; cause?: { message?: string } }) => err,
    );
    expect(failure).not.toBeNull();
    expect(`${failure?.message} ${failure?.cause?.message ?? ""}`).toMatch(/FOREIGN KEY/i);
  });

  it("re-applies the settings after a transaction dropped them", async () => {
    const { db, sql, applyConnectionPragmas } = await load();

    // libsql's transaction() swaps the shared connection for a fresh one, so
    // this is exactly the state a caller has to recover from.
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    const [off] = await db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
    expect(off.foreign_keys).toBe(0);

    await applyConnectionPragmas();

    const [on] = await db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
    expect(on.foreign_keys).toBe(1);
  });

  it("truncates the write-ahead log and reports the result", async () => {
    const { db, sql } = await load();
    await db.run(sql`CREATE TABLE probe (id INTEGER PRIMARY KEY, value TEXT)`);
    await db.run(sql`INSERT INTO probe (value) VALUES ('x')`);
    expect(existsSync(walFile)).toBe(true);

    const { checkpointWal } = await import("@/lib/db-maintenance");
    const result = await checkpointWal("TRUNCATE");

    expect(result).not.toBeNull();
    expect(result?.busy).toBe(false);
    // TRUNCATE leaves a zero-length -wal behind (not a deleted file); what
    // matters is that no frames are waiting to be replayed by a restore.
    expect(existsSync(walFile) ? statSync(walFile).size : 0).toBe(0);
  });
});
