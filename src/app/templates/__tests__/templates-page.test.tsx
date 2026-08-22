import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TemplatesPage from "@/app/templates/page";
import { filterTemplates } from "@/lib/template-utils";

const sampleTemplates = [
  { id: 1, name: "عقد توريد", description: "عقد توريد مواد", titlePattern: "{{title}}", departmentId: null, folderId: null, docType: "عقد", defaultTags: "توريد,شراء", status: "active", sortOrder: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: 2, name: "فاتورة ضريبية", description: null, titlePattern: "فاتورة {{title}}", departmentId: null, folderId: null, docType: "فاتورة", defaultTags: null, status: "active", sortOrder: 2, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: 3, name: "مذكرة داخلية", description: "مذكرة للموظفين", titlePattern: "مذكرة {{title}}", departmentId: null, folderId: null, docType: null, defaultTags: "داخلي", status: "active", sortOrder: 3, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: 4, name: "كشف رواتب", description: "كشف رواتب الموظفين", titlePattern: "رواتب {{date}}", departmentId: 1, folderId: 1, docType: "تقرير", defaultTags: "موارد بشرية,رواتب", status: "active", sortOrder: 4, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
];

describe("filterTemplates (pure logic)", () => {
  it("returns all templates when search is empty", () => {
    const result = filterTemplates(sampleTemplates, "");
    expect(result).toHaveLength(4);
  });

  it("returns all templates when search is whitespace", () => {
    const result = filterTemplates(sampleTemplates, "   ");
    expect(result).toHaveLength(4);
  });

  it("filters by name (case-insensitive)", () => {
    const result = filterTemplates(sampleTemplates, "عقد");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("عقد توريد");
  });

  it("filters by description", () => {
    const result = filterTemplates(sampleTemplates, "موظف");
    expect(result).toHaveLength(2); // "مذكرة داخلية" and "كشف رواتب"
    expect(result.map((t) => t.name).sort()).toEqual(["كشف رواتب", "مذكرة داخلية"]);
  });

  it("filters by docType", () => {
    const result = filterTemplates(sampleTemplates, "فاتورة");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("فاتورة ضريبية");
  });

  it("filters by defaultTags", () => {
    const result = filterTemplates(sampleTemplates, "شراء");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("عقد توريد");
  });

  it("filters by defaultTags with multiple matching", () => {
    const result = filterTemplates(sampleTemplates, "رواتب");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("كشف رواتب");
  });

  it("returns empty array when no match", () => {
    const result = filterTemplates(sampleTemplates, "zzzzzz");
    expect(result).toHaveLength(0);
  });

  it("handles null description gracefully", () => {
    // name match still works even when description is null
    const result = filterTemplates(sampleTemplates, "فاتورة ضريبية");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("فاتورة ضريبية");
    // partial name match also works
    const byName = filterTemplates(sampleTemplates, "ضريبية");
    expect(byName).toHaveLength(1);
    expect(byName[0].name).toBe("فاتورة ضريبية");
  });
});

// ── Component rendering tests ──────────────────────────────────────────────────

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("TemplatesPage (component)", () => {
  it("renders the page title", async () => {
    // Mock fetch to return empty data
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<TemplatesPage />);
    // await flushes the async fetch inside act(), avoiding wrap-tests-with-act warnings
    expect(await screen.findByText("قوالب المستندات")).toBeInTheDocument();
  });

  it("renders empty state when no templates exist", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("لا توجد قوالب بعد. أنشئ قالباً لتبدأ.")).toBeInTheDocument();
    });
  });

  it("renders templates after loading", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/templates") return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleTemplates) });
      if (url === "/api/quick/department") return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url === "/api/quick/folder") return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("عقد توريد")).toBeInTheDocument();
      expect(screen.getByText("فاتورة ضريبية")).toBeInTheDocument();
      expect(screen.getByText("مذكرة داخلية")).toBeInTheDocument();
      expect(screen.getByText("كشف رواتب")).toBeInTheDocument();
    });
  });

  it("filters templates via search input", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/templates") return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleTemplates) });
      if (url === "/api/quick/department") return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url === "/api/quick/folder") return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("عقد توريد")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("بحث في القوالب...");
    fireEvent.change(input, { target: { value: "مذكرة" } });

    await waitFor(() => {
      expect(screen.getByText("مذكرة داخلية")).toBeInTheDocument();
      expect(screen.queryByText("عقد توريد")).not.toBeInTheDocument();
    });
  });

  it("shows no results message when search has no match", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/templates") return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleTemplates) });
      if (url === "/api/quick/department") return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url === "/api/quick/folder") return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("عقد توريد")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("بحث في القوالب...");
    fireEvent.change(input, { target: { value: "xxxxxx" } });

    await waitFor(() => {
      expect(screen.getByText("لا توجد نتائج للبحث")).toBeInTheDocument();
    });
  });
});
