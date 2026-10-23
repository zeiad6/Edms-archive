import { describe, it, expect } from "vitest";
import { clampPagination, DEFAULT_MAX_PAGE_SIZE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@/lib/services/pagination";

describe("clampPagination (pagination service)", () => {
  it("defaults to page 1 / pageSize 50 when no params are provided", () => {
    expect(clampPagination({})).toEqual({ page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE, offset: 0 });
  });

  it("computes the offset from page and pageSize", () => {
    expect(clampPagination({ page: 3, pageSize: 25 })).toEqual({ page: 3, pageSize: 25, offset: 50 });
  });

  it("clamps pageSize to the configured max", () => {
    expect(clampPagination({ page: 2, pageSize: 500 }, 100)).toEqual({ page: 2, pageSize: 100, offset: 100 });
  });

  it("enforces a minimum page of 1 and minimum pageSize of 1", () => {
    expect(clampPagination({ page: 0, pageSize: -5 })).toEqual({ page: 1, pageSize: 1, offset: 0 });
  });

  it("exposes the default maximum page size", () => {
    expect(DEFAULT_MAX_PAGE_SIZE).toBe(100);
  });
});
