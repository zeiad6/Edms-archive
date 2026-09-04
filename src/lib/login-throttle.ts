/**
 * In-memory login brute-force guard (pure, dependency-free).
 *
 * 8 failed attempts per account key per 10 minutes, then throttled.
 * Keyed by account (not IP — server actions have no reliable client IP),
 * counted ONLY on failure so legitimate users are never throttled.
 *
 * Single-process scope: the packaged/Electron and standalone deployments run
 * exactly one Node process, so a Map is sufficient. A multi-process
 * deployment in front of one DB must replace this with a shared store.
 */

export const LOGIN_WINDOW_MS = 10 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 8;

const loginFailures = new Map<string, number[]>();

export function loginThrottled(key: string, now: number = Date.now()): boolean {
  const recent = (loginFailures.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  loginFailures.set(key, recent);
  return recent.length >= LOGIN_MAX_FAILURES;
}

export function recordLoginFailure(key: string, now: number = Date.now()): void {
  const recent = (loginFailures.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  recent.push(now);
  loginFailures.set(key, recent);
}

export function clearLoginFailures(key: string): void {
  loginFailures.delete(key);
}
