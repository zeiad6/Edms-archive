/**
 * In-memory login brute-force guard (pure, dependency-free).
 *
 * 8 failed attempts per account+IP pair per 10 minutes, then throttled.
 * Keys are built via `loginThrottleKey` (account + client IP), counted ONLY
 * on failure so legitimate users are never throttled.
 *
 * Single-process scope: the packaged/Electron and standalone deployments run
 * exactly one Node process, so a Map is sufficient. A multi-process
 * deployment in front of one DB must replace this with a shared store.
 */

export const LOGIN_WINDOW_MS = 10 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 8;
export const LOGIN_MAX_KEYS = 5000;
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

const loginFailures = new Map<string, number[]>();
let lastCleanupAt = 0;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function maybePruneExpired(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS && loginFailures.size < LOGIN_MAX_KEYS) {
    return;
  }
  lastCleanupAt = now;
  for (const [k, timestamps] of loginFailures.entries()) {
    const recent = timestamps.filter((t) => now - t < LOGIN_WINDOW_MS);
    if (recent.length === 0) {
      loginFailures.delete(k);
    } else if (recent.length !== timestamps.length) {
      loginFailures.set(k, recent);
    }
  }
}

/**
 * Build a brute-force throttle key bound to both the normalized account
 * identifier and the originating client IP: `<account>:<ip>`.
 */
export function loginThrottleKey(account: string, ip?: string | null): string {
  const normalizedAccount = account.trim().toLowerCase() || "?";
  const normalizedIp = ip && ip.trim() ? ip.trim().toLowerCase() : "unknown";
  return `${normalizedAccount}:${normalizedIp}`;
}

export function loginThrottled(key: string, now: number = Date.now()): boolean {
  const normalized = normalizeKey(key);
  const existing = loginFailures.get(normalized);
  // Never allocate/set a Map entry when there were no prior failures
  if (!existing) return false;

  const recent = existing.filter((t) => now - t < LOGIN_WINDOW_MS);
  if (recent.length === 0) {
    loginFailures.delete(normalized);
    return false;
  }
  if (recent.length !== existing.length) {
    loginFailures.set(normalized, recent);
  }
  return recent.length >= LOGIN_MAX_FAILURES;
}

export function recordLoginFailure(key: string, now: number = Date.now()): void {
  maybePruneExpired(now);
  const normalized = normalizeKey(key);
  const existing = loginFailures.get(normalized);
  const recent = (existing ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  recent.push(now);

  // Move to MRU end by deleting first if present
  if (existing !== undefined) {
    loginFailures.delete(normalized);
  } else if (loginFailures.size >= LOGIN_MAX_KEYS) {
    // LRU eviction: drop oldest entry at the front of the Map
    const oldestKey = loginFailures.keys().next().value;
    if (oldestKey !== undefined) {
      loginFailures.delete(oldestKey);
    }
  }

  loginFailures.set(normalized, recent);
}

export function clearLoginFailures(key: string): void {
  loginFailures.delete(normalizeKey(key));
}

/** Exposed for unit testing Map size & LRU behavior. */
export function getLoginThrottleMapSize(): number {
  return loginFailures.size;
}
