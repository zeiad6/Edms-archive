import crypto from "crypto";

/**
 * Password hashing (zero-dependency, Node crypto).
 *
 * Format of a stored hash (self-describing, versioned for future params):
 *   `scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>`
 *
 * scrypt parameters follow OWASP guidance for interactive logins
 * (N = 2^15, r = 8, p = 1) with an explicit `maxmem` so the derivation
 * never throws on Node's default 32 MiB cap.
 */

export const DEFAULT_PASSWORD = "12345678";

/**
 * Sanitize a pasted/typed password before comparison, verification, or storage.
 *
 * Copying a password from an RTL page routinely grabs invisible
 * junk around it (trailing spaces/newlines, LRM/RLM marks, zero-width
 * characters) — and pasting it verbatim then fails verification, locking the
 * user out with a correct password. Stripping that surrounding noise is safe:
 * real passwords are never meant to start/end with it. Inner content is left
 * untouched.
 *
 * MUST be applied consistently on both sides: to the *current-password* check
 * at login AND to every new-password input before compare/store (first-login
 * change in `loginUser`, `createUser`/`updateUser`, `changePassword`) —
 * otherwise a dirty paste stored raw will never verify against the sanitized
 * login check.
 */
export function sanitizePastedPassword(raw: string): string {
  return raw.replace(/^[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069]+|[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069]+$/g, "");
}

const SCRYPT_N = 32768; // 2^15 — OWASP minimum-ish for interactive logins
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_MAXMEM = 64 * 1024 * 1024; // 64 MiB > 128*r*N

/**
 * Hash a plaintext password with scrypt and a fresh random salt.
 *
 * @param password - Plaintext password. Never logged or persisted.
 * @returns Self-describing string `scrypt$N$r$p$salt$hash`.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Constant-time verification of a password against a stored hash.
 *
 * Returns `false` (never throws) for: missing/malformed hashes, unknown
 * hash schemes, and wrong passwords — so callers can use one generic
 * error message without leaking which part failed.
 *
 * @param password - Plaintext password to check.
 * @param stored - Stored hash string (may be null for legacy users).
 */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;

  // Keep verification consistent with login and password-change flows: copied
  // RTL text may contain harmless surrounding whitespace/bidi marks.
  password = sanitizePastedPassword(password);
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (
    !Number.isInteger(n) || n < 2 ||
    !Number.isInteger(r) || r < 1 ||
    !Number.isInteger(p) || p < 1
  ) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });
    // timingSafeEqual throws on length mismatch — the expected length is
    // derived from the stored hash, so both buffers are always equal here.
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
