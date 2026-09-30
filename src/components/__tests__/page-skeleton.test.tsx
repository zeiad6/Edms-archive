import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PageSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  BootSplash,
} from "@/components/page-skeleton";

/**
 * The skeletons are async Server Components (they `await getServerLang()`), so
 * the test has to resolve the element before handing it to `render`. Passing
 * `<PageSkeleton />` to render makes React try to render a promise, which
 * fails with "an async Client Component" — that message is misleading: these
 * are Server Components and the async form is correct. `getServerLang()`
 * falls back to "ar" when there is no request context, so no cookie mock is
 * needed here.
 */
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
    // The Skeleton primitive renders `.skeleton-shimmer` (see ui/skeleton.tsx)
    const skeletons = container.querySelectorAll(".skeleton-shimmer");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("exposes an accessible status role and Arabic label", async () => {
    render(await PageSkeleton());
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "جارٍ تحميل الصفحة");
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

describe("DashboardSkeleton", () => {
  it("renders the KPI grid as six shimmer blocks", async () => {
    const { container } = render(await DashboardSkeleton());
    // Guards the layout, not just "it did not throw".
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThanOrEqual(6);
  });
});

describe("BootSplash", () => {
  it("announces itself to assistive tech while the server boots", async () => {
    render(await BootSplash());
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "جارٍ تشغيل نظام الأرشفة",
    );
  });
});
