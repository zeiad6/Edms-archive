import { describe, it, expect } from "vitest";
import {
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  clearLoginFailures,
  loginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

describe("login throttle", () => {
  it("allows attempts below the threshold", () => {
    const key = `t1-${Date.now()}`;
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) recordLoginFailure(key);
    expect(loginThrottled(key)).toBe(false);
  });

  it("throttles at the threshold and recovers after the window", () => {
    const key = `t2-${Date.now()}`;
    const now = Date.now();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) recordLoginFailure(key, now);
    expect(loginThrottled(key, now)).toBe(true);
    expect(loginThrottled(key, now + LOGIN_WINDOW_MS + 1)).toBe(false);
  });

  it("counts only failures — a cleared key is fresh", () => {
    const key = `t3-${Date.now()}`;
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) recordLoginFailure(key);
    expect(loginThrottled(key)).toBe(true);
    clearLoginFailures(key);
    expect(loginThrottled(key)).toBe(false);
  });

  it("isolates keys per account", () => {
    const a = `t4a-${Date.now()}`;
    const b = `t4b-${Date.now()}`;
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) recordLoginFailure(a);
    expect(loginThrottled(a)).toBe(true);
    expect(loginThrottled(b)).toBe(false);
  });
});
