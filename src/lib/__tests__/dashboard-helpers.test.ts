import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getStatusCount,
  generateMonthDates,
  calculateMonthlyTrend,
  calculateStatusSegments,
  getGreeting,
  getTodayFormatted,
  prepareRecentDocuments,
} from "@/lib/dashboard-helpers";
import type { Document } from "@/db/schema";

// ─── getStatusCount ────────────────────────────────────────────────────
describe("getStatusCount", () => {
  const rows = [
    { status: "active", c: 10 },
    { status: "draft", c: 5 },
    { status: "archived", c: 3 },
  ];

  it("returns the count for an existing status", () => {
    expect(getStatusCount(rows, "active")).toBe(10);
    expect(getStatusCount(rows, "draft")).toBe(5);
  });

  it("returns 0 for a missing status", () => {
    expect(getStatusCount(rows, "pending_review")).toBe(0);
  });

  it("returns 0 for an empty array", () => {
    expect(getStatusCount([], "active")).toBe(0);
  });
});

// ─── generateMonthDates ────────────────────────────────────────────────
describe("generateMonthDates", () => {
  it("returns exactly 6 months", () => {
    const months = generateMonthDates();
    expect(months).toHaveLength(6);
  });

  it("each month has label and start fields", () => {
    const months = generateMonthDates();
    for (const m of months) {
      expect(typeof m.label).toBe("string");
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.start).toMatch(/^\d{4}-\d{2}-01$/);
    }
  });

  it("months are in chronological order", () => {
    const months = generateMonthDates();
    const starts = months.map((m) => m.start);
    const sorted = [...starts].sort();
    expect(starts).toEqual(sorted);
  });

  it("last month is the current month", () => {
    const months = generateMonthDates();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    expect(months[5].start).toBe(currentMonth);
  });
});

// ─── calculateMonthlyTrend ─────────────────────────────────────────────
describe("calculateMonthlyTrend", () => {
  it("returns 6 months and correct max", () => {
    const result = calculateMonthlyTrend([1, 5, 3, 0, 2, 8]);
    expect(result.months).toHaveLength(6);
    expect(result.monthlyMax).toBe(8);
  });

  it("monthlyMax is at least 1 even with all zeros", () => {
    const result = calculateMonthlyTrend([0, 0, 0, 0, 0, 0]);
    expect(result.monthlyMax).toBe(1);
  });

  it("monthlyMax handles negative values gracefully", () => {
    const result = calculateMonthlyTrend([-3, -1, -5]);
    expect(result.monthlyMax).toBe(1);
  });
});

// ─── calculateStatusSegments ───────────────────────────────────────────
describe("calculateStatusSegments", () => {
  const rows = [
    { status: "active", c: 40 },
    { status: "pending_review", c: 10 },
    { status: "archived", c: 20 },
    { status: "draft", c: 30 },
  ];

  it("returns 4 segments for all known statuses", () => {
    const segments = calculateStatusSegments(rows, 100);
    expect(segments).toHaveLength(4);
  });

  it("calculates correct percentages", () => {
    const segments = calculateStatusSegments(rows, 100);
    const active = segments.find((s) => s.s === "active")!;
    expect(active.pct).toBe(40);
  });

  it("handles total=0 without division by zero", () => {
    const segments = calculateStatusSegments(rows, 0);
    for (const seg of segments) {
      expect(seg.pct).toBe(0);
    }
  });

  it("assigns correct colors", () => {
    const segments = calculateStatusSegments(rows, 100);
    expect(segments.find((s) => s.s === "active")!.color).toBe("#10b981");
    expect(segments.find((s) => s.s === "pending_review")!.color).toBe("#f59e0b");
    expect(segments.find((s) => s.s === "archived")!.color).toBe("#3b82f6");
    expect(segments.find((s) => s.s === "draft")!.color).toBe("#94a3b8");
  });

  it("counts are correct", () => {
    const segments = calculateStatusSegments(rows, 100);
    expect(segments.find((s) => s.s === "active")!.c).toBe(40);
    expect(segments.find((s) => s.s === "draft")!.c).toBe(30);
  });
});

// ─── getGreeting ───────────────────────────────────────────────────────
describe("getGreeting", () => {
  it("returns a non-empty Arabic string", () => {
    const greeting = getGreeting();
    expect(greeting.length).toBeGreaterThan(0);
  });

  it("returns morning greeting before noon", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T09:00:00"));
    expect(getGreeting()).toBe("صباح الخير");
    vi.useRealTimers();
  });

  it("returns evening greeting after noon", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T15:00:00"));
    expect(getGreeting()).toBe("مساء الخير");
    vi.useRealTimers();
  });
});

// ─── getTodayFormatted ─────────────────────────────────────────────────
describe("getTodayFormatted", () => {
  it("returns a non-empty string", () => {
    const formatted = getTodayFormatted();
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("contains the current year (locale-aware)", () => {
    const formatted = getTodayFormatted();
    // getTodayFormatted uses ar-EG locale which produces Arabic-Indic numerals (e.g. ٢٠٢٦)
    // so we compare against the same locale formatter rather than raw Western digits
    const expectedYear = new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
    }).format(new Date());
    expect(formatted).toContain(expectedYear);
  });
});

// ─── prepareRecentDocuments ────────────────────────────────────────────
describe("prepareRecentDocuments", () => {
  const makeDoc = (id: number): Document =>
    ({
      id,
      title: `Doc ${id}`,
      status: "active",
      departmentId: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }) as unknown as Document;

  const raw = [
    { d: makeDoc(1), deptName: "HR", deptColor: "#f00", uploaderName: "Ali" },
    { d: makeDoc(2), deptName: "IT", deptColor: "#0f0", uploaderName: "Sara" },
    { d: makeDoc(3), deptName: null, deptColor: null, uploaderName: null },
  ];

  it("returns enriched documents with department and uploader names", () => {
    const result = prepareRecentDocuments(raw, { role: "admin" }, () => true);
    expect(result).toHaveLength(3);
    expect(result[0].departmentName).toBe("HR");
    expect(result[0].uploaderName).toBe("Ali");
    expect(result[2].departmentName).toBeNull();
  });

  it("filters out documents the user cannot access", () => {
    const result = prepareRecentDocuments(
      raw,
      { role: "staff" },
      (_user, doc) => (doc as Document).id !== 2
    );
    expect(result).toHaveLength(2);
    expect(result.find((d) => d.id === 2)).toBeUndefined();
  });

  it("limits output to 7 documents", () => {
    const bigRaw = Array.from({ length: 20 }, (_, i) => ({
      d: makeDoc(i + 1),
      deptName: "Dept",
      deptColor: "#000",
      uploaderName: "User",
    }));
    const result = prepareRecentDocuments(bigRaw, null, () => true);
    expect(result).toHaveLength(7);
  });

  it("handles empty input", () => {
    const result = prepareRecentDocuments([], null, () => true);
    expect(result).toHaveLength(0);
  });
});
