import { defineConfig } from "vitest/config";
import path from "path";
import { mkdirSync } from "node:fs";

// The libsql client in `src/db/index.ts` is created at module scope and opens
// `file:./data/edms.db` immediately, so any test that transitively imports
// `@/lib/server` needs the directory to exist before that import is evaluated
// — otherwise it fails with `ConnectionFailed(... : 14)` (SQLITE_CANTOPEN).
//
// This runs in the config file rather than `vitest.setup.ts` on purpose: the
// setup file is evaluated inside the per-file test environment, where the
// default jsdom runtime makes Vite externalize `node:fs` and the whole setup
// file dies with `No such built-in module: node:`. The config always runs in
// Node, which is early enough and correctly scoped.
for (const dir of ["data", "storage"]) {
  mkdirSync(dir, { recursive: true });
}

export default defineConfig({
  test: {
    // `src/db/index.ts` and `src/lib/env.ts` read these at module scope, so
    // they must be set by the runner — an ambient `NODE_ENV=production` (common
    // on a build/deploy host) otherwise makes `env.ts` throw its fail-fast
    // AUTH_SECRET error and every server test dies at import time.
    env: {
      NODE_ENV: "test",
      AUTH_SECRET: "test-only-secret",
      DATABASE_URL: "file:./data/test-edms.db",
    },
    // jsdom is the default because most tests are React component tests.
    // Server-side tests that touch `node:crypto`, `node:fs` or `@/db` opt into
    // the node runtime with a `@vitest-environment node` docblock — under
    // jsdom, Vite externalizes those builtins and the file fails to collect
    // with `No such built-in module: node:`.
    environment: "jsdom",
    // The xlsx end-to-end test builds a real ZIP and validates every entry
    // with zlib. That is well under 5s on CI, but it can exceed the default
    // timeout on a slow or thermally-throttled machine, where the failure
    // looks like a code bug rather than a slow runner.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 30,
        statements: 30,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
