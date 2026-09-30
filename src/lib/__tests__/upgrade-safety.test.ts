// @vitest-environment node
// Upgrade safety: installing a new version over an existing one must never
// alter the user's data. Every app boot runs `ensureSeeded()` (schema DDL,
// column migrations, backfills) against the database the previous version left
// in userData, so this test boots twice on the same DB + storage directory —
// with user-made changes in between — and requires the second boot to leave
// every table row and every stored file byte-for-byte identical.
import { describe, it, expect, vi, afterAll } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const root = mkdtempSync(path.join(tmpdir(), "edms-upgrade-"));
const dbFile = path.join(root, "edms.db").replace(/\\/g, "/");
const storageDir = path.join(root, "storage");

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

/** Fresh module graph = fresh DB client, like a new app process. */
async function boot() {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", `file:${dbFile}`);
  vi.stubEnv("EDMS_STORAGE_DIR", storageDir);
  const { ensureSeeded } = await import("@/lib/seed");
  await ensureSeeded();
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  return { db, sql };
}

async function snapshot({ db, sql }: Awaited<ReturnType<typeof boot>>) {
  const tables = (await db.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  )) as Array<{ name: string }>;
  const rows: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    rows[name] = await db.all(sql.raw(`SELECT * FROM "${name}" ORDER BY rowid`));
  }
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files[path.relative(storageDir, full)] = createHash("sha256").update(readFileSync(full)).digest("hex");
    }
  };
  walk(storageDir);
  return { rows, files };
}

describe("upgrade over an existing installation", () => {
  it("a second boot leaves existing users, documents and files untouched", async () => {
    const first = await boot();
    const { hashPassword, verifyPassword } = await import("@/lib/password");

    // What a real user does between installing 1.0.0 and updating:
    // changes the admin password, adds an account, stores a file.
    const chosen = "my-own-Passw0rd!";
    const hash = await hashPassword(chosen);
    await first.db.run(first.sql`UPDATE users SET password_hash = ${hash}, must_change_password = 0 WHERE username = 'admin'`);
    await first.db.run(
      first.sql`INSERT INTO users (name, username, email, role, password_hash, must_change_password)
                VALUES ('موظف', 'k.alomari', 'k.alomari@edms.gov', 'staff', ${hash}, 0)`
    );
    writeFileSync(path.join(storageDir, "documents", "user-upload.bin"), "user data ✓");

    const before = await snapshot(first);
    expect(before.rows.users.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(before.files)).toContain(path.join("documents", "user-upload.bin"));

    const after = await snapshot(await boot());
    expect(after).toEqual(before);

    const admin = after.rows.users.find((u) => (u as { username: string }).username === "admin") as {
      password_hash: string;
      must_change_password: number;
    };
    expect(verifyPassword(chosen, admin.password_hash)).toBe(true);
    expect(admin.must_change_password).toBe(0);
  });
});
