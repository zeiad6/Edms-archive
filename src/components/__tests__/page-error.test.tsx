import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageError } from "@/components/page-error";

const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  consoleSpy.mockClear();
});

describe("PageError", () => {
  const err = new Error("Something broke");

  it("renders default title and message", () => {
    render(<PageError error={err} reset={() => {}} />);
    expect(screen.getByText("تعذّر تحميل الصفحة")).toBeInTheDocument();
    expect(
      screen.getByText("حدث خطأ أثناء تحميل هذه الصفحة. يرجى المحاولة مرة أخرى."),
    ).toBeInTheDocument();
  });

  it("renders custom title and message", () => {
    render(
      <PageError
        error={err}
        reset={() => {}}
        title="Custom Title"
        message="Custom message"
      />,
    );
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Custom message")).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<PageError error={err} reset={() => {}} />);
    expect(screen.getByRole("button", { name: /إعادة المحاولة/ })).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", async () => {
    const reset = vi.fn();
    render(<PageError error={err} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: /إعادة المحاولة/ }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console on mount", () => {
    render(<PageError error={err} reset={() => {}} />);
    expect(consoleSpy).toHaveBeenCalledWith(err);
  });

  it("renders a custom icon when provided", () => {
    const CustomIcon = () => <span data-testid="custom-icon">X</span>;
    render(<PageError error={err} reset={() => {}} icon={<CustomIcon />} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders the default AlertTriangle SVG icon when no custom icon provided", () => {
    const { container } = render(<PageError error={err} reset={() => {}} />);
    // lucide AlertTriangle renders an SVG element
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
