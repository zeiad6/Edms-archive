/**
 * Shared default-password literals (client-safe — no `node:` imports here).
 *
 * - `DEFAULT_PASSWORD` — factory password for every non-admin demo account.
 * - `ADMIN_DEFAULT_PASSWORD` — factory password for admin accounts
 *   (`role = 'admin'`, e.g. `k.alomari`).
 *
 * Both are consumed server-side by `src/lib/password.ts` (re-exported) and
 * `src/lib/seed.ts`, and client-side by the login demo hint
 * (`src/components/login/login-tabs.tsx`) which cannot import `node:crypto`.
 *
 * Keep the literals in sync everywhere — the README documents them.
 */

export const DEFAULT_PASSWORD = "12345678";

export const ADMIN_DEFAULT_PASSWORD = "Password@1234";
