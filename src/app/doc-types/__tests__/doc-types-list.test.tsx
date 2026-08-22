import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocTypesList } from "@/app/doc-types/doc-types-list";

// Mock next/navigation for InlineEditForm and DeleteDocTypeButton
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const sampleRows = [
  { id: 1, name: "قرار إداري", nameEn: "Admin Decision", color: "#ef4444", sortOrder: 1, docCount: 25 },
  { id: 2, name: "عقد", nameEn: "Contract", color: "#6366f1", sortOrder: 2, docCount: 18 },
  { id: 3, name: "مراسلة رسمية", nameEn: "Official Letter", color: "#06b6d4", sortOrder: 3, docCount: 42 },
  { id: 4, name: "فاتورة", nameEn: "Invoice", color: "#10b981", sortOrder: 4, docCount: 7 },
  { id: 5, name: "تقرير", nameEn: "Report", color: "#f59e0b", sortOrder: 5, docCount: 13 },
];

describe("DocTypesList", () => {
  it("renders all doc types when no search query", () => {
    render(<DocTypesList rows={sampleRows} isAdmin={false} />);
    expect(screen.getByText("قرار إداري")).toBeInTheDocument();
    expect(screen.getByText("عقد")).toBeInTheDocument();
    expect(screen.getByText("مراسلة رسمية")).toBeInTheDocument();
    expect(screen.getByText("فاتورة")).toBeInTheDocument();
    expect(screen.getByText("تقرير")).toBeInTheDocument();
  });

  it("shows English names when provided", () => {
    render(<DocTypesList rows={sampleRows} isAdmin={false} />);
    expect(screen.getByText("Admin Decision")).toBeInTheDocument();
    expect(screen.getByText("Contract")).toBeInTheDocument();
  });

  it("filters by Arabic name", () => {
    render(<DocTypesList rows={sampleRows} isAdmin={false} />);
    const input = screen.getByPlaceholderText("بحث في التصنيفات...");
    fireEvent.change(input, { target: { value: "عقد" } });
    expect(screen.getByText("عقد")).toBeInTheDocument();
    expect(screen.queryByText("قرار إداري")).not.toBeInTheDocument();
    expect(screen.queryByText("فاتورة")).not.toBeInTheDocument();
  });

  it("filters by English name (case-insensitive)", () => {
    render(<DocTypesList rows={sampleRows} isAdmin={false} />);
    const input = screen.getByPlaceholderText("بحث في التصنيفات...");
    fireEvent.change(input, { target: { value: "invoice" } });
    expect(screen.getByText("فاتورة")).toBeInTheDocument();
    expect(screen.getByText("Invoice")).toBeInTheDocument();
  });

  it("shows no-results message when filter has no matches", () => {
    render(<DocTypesList rows={sampleRows} isAdmin={false} />);
    const input = screen.getByPlaceholderText("بحث في التصنيفات...");
    fireEvent.change(input, { target: { value: "xyz" } });
    expect(screen.getByText("لا توجد نتائج مطابقة")).toBeInTheDocument();
  });

  it("shows empty message when no rows exist and no search", () => {
    render(<DocTypesList rows={[]} isAdmin={false} />);
    expect(screen.getByText("لا توجد تصنيفات بعد")).toBeInTheDocument();
  });

  it("shows admin controls when isAdmin is true", () => {
    render(<DocTypesList rows={sampleRows} isAdmin={true} />);
    // InlineEditForm renders a "تعديل" button
    const editButtons = screen.getAllByText("تعديل");
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it("hides admin controls when isAdmin is false", () => {
    render(<DocTypesList rows={sampleRows} isAdmin={false} />);
    expect(screen.queryByText("تعديل")).not.toBeInTheDocument();
  });

  it("clears search when X button is clicked", () => {
    render(<DocTypesList rows={sampleRows} isAdmin={false} />);
    const input = screen.getByPlaceholderText("بحث في التصنيفات...");
    fireEvent.change(input, { target: { value: "عقد" } });
    expect(screen.getByText("عقد")).toBeInTheDocument();

    const clearButton = screen.getByRole("button");
    fireEvent.click(clearButton);
    expect(screen.getByText("عقد")).toBeInTheDocument(); // back to full list
    expect(screen.getByText("قرار إداري")).toBeInTheDocument();
  });

  it("does not show search bar when 3 or fewer rows", () => {
    render(<DocTypesList rows={sampleRows.slice(0, 3)} isAdmin={false} />);
    expect(screen.queryByPlaceholderText("بحث في التصنيفات...")).not.toBeInTheDocument();
  });
});
