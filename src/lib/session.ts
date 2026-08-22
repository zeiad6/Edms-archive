/**
 * Session-cookie contract for the demo (cookie-based) auth.
 *
 * Single source of truth shared by `src/proxy.ts`, `src/actions/auth.ts` and
 * `src/lib/server.ts` so the cookie name, attributes and signing scheme can
 * never drift between the writer/reader sites.
 *
 * Cookies are HMAC-SHA256 signed (`<uid>.<signature>`, base64url) with
 * `AUTH_SECRET` so a plain `edms_uid=1` can no longer be forged by a visitor.
 * Next.js 16 runs `proxy.ts` on the Node.js runtime, so `node:crypto` is
 * available in every consumer of this module.
 */

import crypto from "crypto";

export const SESSION_COOKIE = "edms_uid" as const;

export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "strict" as const,
  // The demo is served over plain HTTP, so `secure: true` would make browsers
  // silently reject the cookie (Secure cookies are refused from insecure
  // origins) — switchUser/logoutUser would appear to do nothing. `secure:
  // false` works on both HTTP and HTTPS.
  secure: false,
  maxAge: 60 * 60 * 24 * 30, // 30 days
} as const;

/**
 * Development-only fallback. Never use in production: `AUTH_SECRET` MUST be
 * set in the environment — `.env.example` documents how to generate one.
 */
const DEV_FALLBACK_SECRET = "dev-secret-change-me";

/** Resolve the HMAC key, warning loudly when the env secret is missing. */
function getSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  console.warn(
    "[session] AUTH_SECRET غير مضبوط — جلسات الكوكي ستُوقَّع بالمفتاح الاحتياطي للتطوير فقط. اضبط AUTH_SECRET في .env قبل النشر."
  );
  return DEV_FALLBACK_SECRET;
}

/**
 * Sign a session cookie value: `<uid>.<hmac>` where the HMAC is
 * SHA-256 of the uid keyed with `AUTH_SECRET`, encoded base64url (43 chars,
 * no padding).
 *
 * @param uid - The user identifier to bind to the signature.
 * @returns The signed cookie value.
 */
export function signSession(uid: string): string {
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(uid)
    .digest("base64url");
  return `${uid}.${signature}`;
}

/**
 * Verify a signed session cookie value. Returns the bound uid when the
 * signature matches, `null` otherwise (missing/tampered/malformed).
 *
 * Comparison is timing-safe so an attacker cannot measure the secret by
 * diffing response times.
 *
 * @param token - The raw cookie value (`<uid>.<signature>`).
 * @returns The verified uid, or null when the token is not authentic.
 */
export function verifySession(token: string): string | null {
  if (!token || token.length > 200) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const uid = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  // SHA-256 HMAC in base64url is exactly 43 chars — reject anything else
  // before doing any crypto work.
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(uid)
    .digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? uid : null;
}
