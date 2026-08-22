import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/empty-state";
import { FileText } from "lucide-react";

describe("EmptyState (unified)", () => {
  it("renders title and description", () => {
    render(<EmptyState title="لا توجد بيانات" description="وصف توضيحي" />);
    expect(screen.getByText("لا توجد بيانات")).toBeTruthy();
    expect(screen.getByText("وصف توضيحي")).toBeTruthy();
  });

  it("renders the action link with correct href", () => {
    render(<EmptyState title="فارغ" action={{ label: "رفع مستند", href: "/upload" }} />);
    const link = screen.getByRole("link", { name: "رفع مستند" });
    expect(link.getAttribute("href")).toBe("/upload");
  });

  it("does not render action when not provided", () => {
    render(<EmptyState title="فارغ" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("renders a custom icon (title + icon source)", () => {
    const { container } = render(<EmptyState icon={FileText} title="لا مستندات" />);
    // lucide renders an <svg>; assert svg present
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("applies compact classes when compact is set", () => {
    const { container } = render(<EmptyState title="فارغ" compact />);
    expect(container.querySelector(".py-8")).toBeTruthy();
  });
});
