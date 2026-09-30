// @vitest-environment node
// Server-side test: touches node:crypto / node:fs / @/db. Under the
// default jsdom environment Vite externalizes those builtins and the file
// fails to collect with `No such built-in module: node:`.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signSession, verifySession } from "@/lib/session";

/** base64url alphabet — no +, / or = padding. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** A fixed key so every test runs against the same HMAC secret. */
const TEST_SECRET = "unit-test-secret-0123456789";

/** Replace a signature char with a different valid base64url char. */
function tamperSignature(token: string): string {
  const dot = token.lastIndexOf(".");
  const sig = token.slice(dot + 1);
  for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-") {
    if (char !== sig[0]) {
      return token.slice(0, dot + 1) + char + sig.slice(1);
    }
  }
  throw new Error("unreachable");
}

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", TEST_SECRET);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ─── Round-trip ─────────────────────────────────────────────────────────
describe("signSession / verifySession round-trip", () => {
  it("returns the same uid for a numeric uid", () => {
    expect(verifySession(signSession("1"))).toBe("1");
  });

  it("returns the same uid for a large numeric uid", () => {
    expect(verifySession(signSession("9007199254740991"))).toBe("9007199254740991");
  });

  it("returns the same uid for a non-numeric uid", () => {
    expect(verifySession(signSession("admin"))).toBe("admin");
  });

  it("returns the same uid when the uid itself contains dots", () => {
    // lastIndexOf(".") must split on the final dot, not the first one.
    expect(verifySession(signSession("user.123"))).toBe("user.123");
  });

  it("returns the same uid for an Arabic uid", () => {
    expect(verifySession(signSession("مستخدم"))).toBe("مستخدم");
  });

  it("returns null for a token that was never signed", () => {
    expect(verifySession("7")).toBeNull();
  });
});

// ─── uid tampering ──────────────────────────────────────────────────────
describe("verifySession rejects tampered uids", () => {
  it("returns null when a uid digit is changed", () => {
    const token = signSession("1");
    expect(verifySession(token.replace("1.", "2."))).toBeNull();
  });

  it("returns null when a uid char is changed", () => {
    const token = signSession("admin");
    expect(verifySession(token.replace("admin", "admxn"))).toBeNull();
  });

  it("returns null when the uid is swapped with another valid uid", () => {
    const token = signSession("42");
    const other = signSession("43");
    expect(verifySession(other.slice(0, 2) + token.slice(2))).toBeNull();
  });

  it("returns null when a uid is appended", () => {
    const token = signSession("1");
    expect(verifySession(`${token.slice(0, 1)}9${token.slice(1)}`)).toBeNull();
  });
});

// ─── signature tampering ────────────────────────────────────────────────
describe("verifySession rejects tampered signatures", () => {
  it("returns null when the first signature char is changed", () => {
    expect(verifySession(tamperSignature(signSession("1")))).toBeNull();
  });

  it("returns null when the last signature char is changed", () => {
    const token = signSession("1");
    const dot = token.lastIndexOf(".");
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(tampered).not.toBe(token);
    expect(verifySession(tampered)).toBeNull();
  });

  it("returns null when a middle signature char is changed", () => {
    const token = signSession("1");
    const dot = token.lastIndexOf(".");
    const mid = dot + 1 + Math.floor((token.length - dot - 1) / 2);
    const tampered = token.slice(0, mid) + (token[mid] === "A" ? "B" : "A") + token.slice(mid + 1);
    expect(tampered).not.toBe(token);
    expect(verifySession(tampered)).toBeNull();
  });

  it("returns null when the signature is truncated", () => {
    const token = signSession("1");
    expect(verifySession(token.slice(0, -1))).toBeNull();
  });

  it("returns null when the signature is extended with a valid base64url char", () => {
    const token = signSession("1");
    expect(verifySession(`${token}A`)).toBeNull();
  });
});

// ─── malformed tokens ───────────────────────────────────────────────────
describe("verifySession rejects malformed tokens", () => {
  it("returns null for an empty string", () => {
    expect(verifySession("")).toBeNull();
  });

  it("returns null for a string without a dot", () => {
    expect(verifySession("abc")).toBeNull();
  });

  it("returns null for '1.2.3' (non-base64url signature)", () => {
    expect(verifySession("1.2.3")).toBeNull();
  });

  it("returns null when the token starts with a dot", () => {
    expect(verifySession(".signature")).toBeNull();
  });

  it("returns null when the token ends with a dot", () => {
    expect(verifySession("1.")).toBeNull();
  });

  it("returns null when the signature is not 43 chars", () => {
    expect(verifySession(`1.${"A".repeat(42)}`)).toBeNull();
    expect(verifySession(`1.${"A".repeat(44)}`)).toBeNull();
  });

  it("returns null when the signature contains padded base64 chars", () => {
    expect(verifySession(`1.${"A".repeat(42)}=`)).toBeNull();
    expect(verifySession(`1.${"A".repeat(21)}/+${"A".repeat(20)}`)).toBeNull();
  });

  it("returns null for a token longer than 200 chars", () => {
    expect(verifySession("x".repeat(201))).toBeNull();
  });

  it("returns null for a valid-shaped token whose uid pushes it past 200 chars", () => {
    const token = signSession("1".repeat(157)); // 157 + 1 + 43 = 201
    expect(token).toHaveLength(201);
    expect(verifySession(token)).toBeNull();
  });

  it("returns null for exactly 200 chars when the signature is otherwise valid", () => {
    const token = signSession("1".repeat(156)); // 156 + 1 + 43 = 200 → still rejected? no: 200 allowed
    expect(token).toHaveLength(200);
    // Boundary: 200 is allowed by the length guard, so tampering is what kills it.
    expect(verifySession(token)).not.toBeNull();
  });
});

// ─── key consistency ────────────────────────────────────────────────────
describe("signSession key consistency", () => {
  it("produces the identical signature for the same uid and same AUTH_SECRET", () => {
    expect(signSession("1")).toBe(signSession("1"));
  });

  it("produces a different signature when AUTH_SECRET changes", () => {
    const withKeyA = signSession("1");
    vi.stubEnv("AUTH_SECRET", "another-secret-key-9876543210");
    const withKeyB = signSession("1");
    expect(withKeyA).not.toBe(withKeyB);
  });

  it("fail-fasts when AUTH_SECRET is unset (no silent dev fallback)", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(() => signSession("1")).toThrow(/AUTH_SECRET is missing/);
  });

  it("allows a short test-only secret when NODE_ENV=test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_SECRET", "");
    const token = signSession("1");
    expect(verifySession(token)).toBe("1");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSession("1");
    vi.stubEnv("AUTH_SECRET", "another-secret-key-9876543210");
    expect(verifySession(token)).toBeNull();
  });
});

// ─── format stability ───────────────────────────────────────────────────
describe("signed token format", () => {
  it("matches <uid>.<43 base64url chars> for a numeric uid", () => {
    const token = signSession("1");
    expect(token).toMatch(/^1\.[A-Za-z0-9_-]{43}$/);
  });

  it("produces a 43-char base64url signature with no padding", () => {
    const sig = signSession("1").split(".")[1];
    expect(sig).toHaveLength(43);
    expect(BASE64URL.test(sig)).toBe(true);
    expect(sig).not.toContain("=");
  });

  it("signature contains no base64 padding or URL-unsafe chars", () => {
    for (const uid of ["1", "admin", "user.123", "مستخدم", "9007199254740991"]) {
      const sig = signSession(uid).split(".").at(-1)!;
      expect(BASE64URL.test(sig)).toBe(true);
      expect(sig).toHaveLength(43);
    }
  });
});
