/**
 * One-time server bootstrap.
 *
 * The schema has to exist before any route can query it. Seeding per route
 * made that a contract every page and route handler had to remember, and the
 * ones that forgot raced the very first request on a fresh install: `/`
 * redirects to `/login`, so the login page rendered first, queried `users`
 * before the DDL had run, SSR threw `no such table: users`, and the window
 * never finished loading.
 *
 * `register()` runs once when the Next server boots, so the schema is ready
 * before the first request rather than something each route has to arrange.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureSeeded } = await import("@/lib/seed");
  await ensureSeeded();
}