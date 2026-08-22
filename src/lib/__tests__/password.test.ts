import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, DEFAULT_PASSWORD } from "@/lib/password";

describe("hashPassword", () => {
  it("returns a self-describing scrypt hash with 6 parts", () => {
    const hash = hashPassword("Secret@123");
    const parts = hash.split("$");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBeGreaterThanOrEqual(2); // N
    expect(Number(parts[2])).toBeGreaterThanOrEqual(1); // r
    expect(Number(parts[3])).toBeGreaterThanOrEqual(1); // p
    expect(parts[4]).toMatch(/^[0-9a-f]+$/); // salt hex
    expect(parts[5]).toMatch(/^[0-9a-f]+$/); // hash hex
  });

  it("produces a different hash per call (fresh salt)", () => {
    expect(hashPassword("Secret@123")).not.toBe(hashPassword("Secret@123"));
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", () => {
    const hash = hashPassword("Secret@123");
    expect(verifyPassword("Secret@123", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashPassword("Secret@123");
    expect(verifyPassword("Wrong@123", hash)).toBe(false);
  });

  it("rejects null / undefined stored hashes (legacy users)", () => {
    expect(verifyPassword("Secret@123", null)).toBe(false);
    expect(verifyPassword("Secret@123", undefined)).toBe(false);
  });

  it("rejects malformed hashes", () => {
    expect(verifyPassword("Secret@123", "not-a-hash")).toBe(false);
    expect(verifyPassword("Secret@123", "scrypt$1$2$3$aa$bb")).toBe(false); // N < 2
    expect(verifyPassword("Secret@123", "bcrypt$32768$8$1$aa$bb")).toBe(false); // unknown scheme
  });

  it("rejects hashes with empty salt or hash", () => {
    expect(verifyPassword("Secret@123", "scrypt$32768$8$1$$bb")).toBe(false);
    expect(verifyPassword("Secret@123", "scrypt$32768$8$1$aa$")).toBe(false);
  });

  it("round-trips the seed DEFAULT_PASSWORD (seed backfill contract)", () => {
    const hash = hashPassword(DEFAULT_PASSWORD);
    expect(verifyPassword(DEFAULT_PASSWORD, hash)).toBe(true);
    expect(verifyPassword("not-the-default", hash)).toBe(false);
  });
});