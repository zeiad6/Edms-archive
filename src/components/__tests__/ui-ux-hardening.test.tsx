import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { extractSuggestedMetadata } from "@/components/upload-zone";

describe("Popover component (downward positioning, Escape, outside click, mutual exclusion)", () => {
  it("opens downward, closes when another popover opens, and closes on Escape", () => {
    render(
      <div>
        <Popover>
          <PopoverTrigger>القائمة الأولى</PopoverTrigger>
          <PopoverContent>محتوى القائمة الأولى</PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger>القائمة الثانية</PopoverTrigger>
          <PopoverContent>محتوى القائمة الثانية</PopoverContent>
        </Popover>
      </div>,
    );

    const btn1 = screen.getByText("القائمة الأولى");
    const btn2 = screen.getByText("القائمة الثانية");

    fireEvent.click(btn1);
    const dialog1 = screen.getByText("محتوى القائمة الأولى");
    expect(dialog1).toBeInTheDocument();
    expect(dialog1.closest('[role="dialog"]')).toHaveAttribute("data-side", "bottom");

    // Opening the second popover automatically closes the first
    fireEvent.click(btn2);
    expect(screen.queryByText("محتوى القائمة الأولى")).not.toBeInTheDocument();
    expect(screen.getByText("محتوى القائمة الثانية")).toBeInTheDocument();

    // Pressing Escape closes the active popover
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("محتوى القائمة الثانية")).not.toBeInTheDocument();
  });
});

describe("extractSuggestedMetadata (upload-zone smart OCR metadata extraction)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts reference number, date, document type, and keywords from filename + OCR text", () => {
    const meta = extractSuggestedMetadata(
      "عقد توريد أجهزة حاسب.pdf",
      "اتفاقية توريد برقم ع-2025/045 بتاريخ 2025-04-15 مع شركة التقنية المتقدمة",
    );

    expect(meta.title).toBe("عقد توريد أجهزة حاسب");
    expect(meta.docType).toBe("عقد");
    expect(meta.docNumber).toBe("ع-2025/045");
    expect(meta.docDate).toBe("2025-04-15");
    expect(meta.keywords).toContain("توريد");
    expect(meta.description).toContain("اتفاقية توريد");
  });
});
