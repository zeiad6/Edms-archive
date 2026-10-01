// @vitest-environment node
// Regression: a fresh install must have a usable schema before the first
// request, not after whichever route happens to seed first.
//
// The shipping bug was that seeding was a per-route contract, and the login
// page — the first page a fresh install renders, since `/` redirects to
// `/login` — queried `users` without awaiting it. SSR threw
// `SQLITE_ERROR: no such table: users`, the render never completed, and the
// Electron window never finished loading. `/api/health` still answered ok the
// whole time, because the Next child serves it independently of the window,
// which is why the old release gate kept passing a build that could not boot.
//
// This test boots the way the Next server does (`register()` from
// `src/instrumentation.ts`) against a database that does not exist yet, then
// runs the login page's exact query with no seed of its own.
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = mkdtempSync(path.join(tmpdir(), "edms-boot-seed-"));
const dbFile = path.join(root, "edms.db").replace(/\\/g, "/");

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  // Fresh module graph = fresh libsql client, like a new app process, and a
  // database file that is not there yet — the first-run state.
  vi.resetModules();
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-wal`, { force: true });
  rmSync(`${dbFile}-shm`, { force: true });
  vi.stubEnv("DATABASE_URL", `file:${dbFile}`);
  vi.stubEnv("EDMS_STORAGE_DIR", path.join(root, "storage"));
  // Next.js sets this for the server runtime; vitest does not, and register()
  // correctly no-ops outside it.
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
});

describe("boot-time schema creation", () => {
  it("creates the schema on server boot, before any route queries it", async () => {
    // This is the only production caller of ensureSeeded() at startup.
    const { register } = await import("@/instrumentation");
    await register();

    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    const { sql } = await import("drizzle-orm");

    // Exactly the query LoginPage issues, with no seed of its own.
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        jobTitle: users.jobTitle,
        avatarColor: users.avatarColor,
        username: users.username,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .orderBy(users.name);

    expect(Array.isArray(allUsers)).toBe(true);
    // A fresh install seeds the default accounts, so the table is not empty.
    expect(allUsers.length).toBeGreaterThan(0);
  });

  it("leaves the window-load query used by the login page able to run twice without re-seeding damage", async () => {
    const { register } = await import("@/instrumentation");
    await register();

    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");

    const before = await db.select({ id: users.id }).from(users);
    await register();
    const after = await db.select({ id: users.id }).from(users);

    expect(after.length).toBe(before.length);
  });

  it("makes /api/health answer ok on a fresh database", async () => {
    const { register } = await import("@/instrumentation");
    await register();

    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    // What the health route checks, before it reports ok.
    await expect(db.run(sql`select 1`)).resolves.toBeDefined();
  });

  it("renders the login page on a fresh database with nothing else seeding first", async () => {
    // Deliberately no register() call here. This is the shipping failure: `/`
    // redirects to `/login`, so on a fresh install the login page was the very
    // first thing rendered, nothing had seeded yet, and its `users` query threw
    // `no such table: users` — which left the window permanently loading. The
    // page has to be able to stand on its own.
    const { default: LoginPage } = await import("@/app/login/page");

    await expect(LoginPage()).resolves.toBeTruthy();
  });
});