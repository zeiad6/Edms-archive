import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagsList } from "@/app/tags/tags-list";

// Mock server actions used by TagRow
vi.mock("@/actions/tags", () => ({
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

const sampleTags = [
  { id: 1, name: "عقود", color: "#ef4444", docCount: 12 },
  { id: 2, name: "فواتير", color: "#3b82f6", docCount: 5 },
  { id: 3, name: "تقارير", color: "#10b981", docCount: 8 },
  { id: 4, name: "مراسلات", color: "#f59e0b", docCount: 3 },
  { id: 5, name: "مستندات قانونية", color: "#8b5cf6", docCount: 15 },
  { id: 6, name: "شهادات", color: "#ec4899", docCount: 2 },
];

describe("TagsList", () => {
  it("renders all tags when no search query", () => {
    render(<TagsList tags={sampleTags} />);
    expect(screen.getByText("عقود")).toBeInTheDocument();
    expect(screen.getByText("فواتير")).toBeInTheDocument();
    expect(screen.getByText("تقارير")).toBeInTheDocument();
    expect(screen.getByText("مراسلات")).toBeInTheDocument();
    expect(screen.getByText("مستندات قانونية")).toBeInTheDocument();
    expect(screen.getByText("شهادات")).toBeInTheDocument();
  });

  it("displays filtered count correctly when no filter", () => {
    render(<TagsList tags={sampleTags} />);
    expect(screen.getByText(/6 \/ 6 وسام/)).toBeInTheDocument();
  });

  it("shows count that matches filtered results", async () => {
    render(<TagsList tags={sampleTags} />);
    const input = screen.getByPlaceholderText("بحث في الوسوم...");
    fireEvent.change(input, { target: { value: "عقود" } });
    // Only "عقود" matches
    expect(screen.getByText(/1 \/ 6 وسام/)).toBeInTheDocument();
  });

  it("filters tags by name", () => {
    render(<TagsList tags={sampleTags} />);
    const input = screen.getByPlaceholderText("بحث في الوسوم...");
    fireEvent.change(input, { target: { value: "فوات" } });
    expect(screen.getByText("فواتير")).toBeInTheDocument();
    expect(screen.queryByText("عقود")).not.toBeInTheDocument();
    expect(screen.queryByText("تقارير")).not.toBeInTheDocument();
  });

  it("shows no results message when search has no matches", () => {
    render(<TagsList tags={sampleTags} />);
    const input = screen.getByPlaceholderText("بحث في الوسوم...");
    fireEvent.change(input, { target: { value: "zzzz" } });
    expect(screen.getByText("لا توجد نتائج")).toBeInTheDocument();
    expect(screen.getByText("حاول بكلمة بحث مختلفة")).toBeInTheDocument();
  });

  it("renders empty state when no tags exist and no search", () => {
    render(<TagsList tags={[]} />);
    expect(screen.getByText("لا توجد وسوم بعد")).toBeInTheDocument();
    expect(screen.getByText("أضف وسماً جديداً ليظهر هنا")).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", () => {
    render(<TagsList tags={sampleTags} />);
    const input = screen.getByPlaceholderText("بحث في الوسوم...");
    fireEvent.change(input, { target: { value: "عقود" } });
    expect(screen.getByText("عقود")).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: "" });
    // The X button is the clear button
    fireEvent.click(clearButton);
    expect(screen.getByText("عقود")).toBeInTheDocument(); // all tags back
    expect(screen.getByText(/6 \/ 6 وسام/)).toBeInTheDocument();
  });

  it("does not show search bar when 5 or fewer tags", () => {
    render(<TagsList tags={sampleTags.slice(0, 3)} />);
    expect(screen.queryByPlaceholderText("بحث في الوسوم...")).not.toBeInTheDocument();
  });
});
