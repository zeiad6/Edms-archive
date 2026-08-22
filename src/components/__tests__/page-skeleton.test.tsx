import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageSkeleton, TableSkeleton } from "@/components/page-skeleton";

describe("PageSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<PageSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("has the animate-fadein class", () => {
    const { container } = render(<PageSkeleton />);
    expect(container.firstChild).toHaveClass("animate-fadein");
  });

  it("renders multiple skeleton elements", () => {
    const { container } = render(<PageSkeleton />);
    // Skeleton renders divs with animate-pulse class
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("TableSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<TableSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("has the animate-fadein class", () => {
    const { container } = render(<TableSkeleton />);
    expect(container.firstChild).toHaveClass("animate-fadein");
  });

  it("renders skeleton elements for table layout", () => {
    const { container } = render(<TableSkeleton />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
