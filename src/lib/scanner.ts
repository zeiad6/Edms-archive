/** Shared types, constants, and helpers for the scanner UI. */

export interface Option {
  id: number;
  name: string;
}

export const DEFAULT_TITLE = "مستند ممسوح ضوئياً";
export const DEFAULT_DOC_TYPE = "صورة ضوئية";

export const INPUT_CLS =
  "w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30";

export interface SavePayload {
  title: string;
  docType: string;
  departmentId?: number;
  folderId?: number;
  docNumber: string;
  description: string;
  dataUrl: string;
}

/** Reads the save form fields into the payload expected by saveScannedDocument. */
export function buildSavePayload(fd: FormData, dataUrl: string): SavePayload {
  return {
    title: String(fd.get("title") || DEFAULT_TITLE),
    docType: String(fd.get("docType") || DEFAULT_DOC_TYPE),
    departmentId: fd.get("departmentId") ? Number(fd.get("departmentId")) : undefined,
    folderId: fd.get("folderId") ? Number(fd.get("folderId")) : undefined,
    docNumber: String(fd.get("docNumber") || ""),
    description: String(fd.get("description") || ""),
    dataUrl,
  };
}