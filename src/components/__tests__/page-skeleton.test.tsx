import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageSkeleton, TableSkeleton } from "@/components/page-skeleton";

describe("PageSkeleton", () => {
  it("renders without crashing", async () => {
    const { container } = render(await PageSkeleton());
    expect(container.firstChild).toBeInTheDocument();
  });

  it("has the animate-fadein class", async () => {
    const { container } = render(await PageSkeleton());
    expect(container.firstChild).toHaveClass("animate-fadein");
  });

  it("renders multiple skeleton elements", async () => {
    const { container } = render(await PageSkeleton());
    // Skeleton renders divs with animate-pulse class
    const skeletons = container.querySelectorAll(".skeleton-shimmer");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("TableSkeleton", () => {
  it("renders without crashing", async () => {
    const { container } = render(await TableSkeleton());
    expect(container.firstChild).toBeInTheDocument();
  });

  it("has the animate-fadein class", async () => {
    const { container } = render(await TableSkeleton());
    expect(container.firstChild).toHaveClass("animate-fadein");
  });

  it("renders skeleton elements for table layout", async () => {
    const { container } = render(await TableSkeleton());
    const skeletons = container.querySelectorAll(".skeleton-shimmer");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
