// Stubs the server-action module BEFORE the component is imported. The
// component imports `@/actions/documents`, which reaches `@/lib/server`
// (next/headers + node:crypto) — builtins jsdom cannot load. Mocking the
// action module is the standard seam: it keeps this a real jsdom render test
// and removes the server dependency from the import graph entirely.
vi.mock("@/actions/documents", () => ({
  emptyTrash: vi.fn(async () => {}),
  restoreDocument: vi.fn(async () => {}),
  forceDeleteDocument: vi.fn(async () => {}),
}));

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrashClient from "@/components/trash-client";

const sampleDoc = {
  id: 1,
  title: "عقد إيجار",
  docNumber: "DOC-001",
  docType: "عقد",
  mimeType: "application/pdf",
  fileSize: 2048,
  deletedAt: "2026-01-15T10:00:00Z",
  fileName: "lease.pdf",
  originalName: "lease.pdf",
};

describe("TrashClient", () => {
  it("shows the empty-trash state when there are no deleted documents", () => {
    render(<TrashClient deletedDocs={[]} totalCount={0} docTypes={[]} />);
    expect(screen.getByText("السلة فارغة")).toBeInTheDocument();
    expect(
      screen.getByText("المستندات المحذوفة ستظهر هنا. يمكنك استعادتها أو حذفها نهائياً."),
    ).toBeInTheDocument();
  });

  it("shows the no-results state when the search matches nothing", async () => {
    render(<TrashClient deletedDocs={[sampleDoc]} totalCount={1} docTypes={["عقد"]} />);
    await userEvent.type(
      screen.getByPlaceholderText("بحث في العنوان أو الرقم..."),
      "مصطلح غير موجود",
    );
    expect(screen.getByText("لا توجد نتائج")).toBeInTheDocument();
    expect(screen.queryByText("عقد إيجار")).not.toBeInTheDocument();
  });
});