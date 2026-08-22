// Shared types, CSV parser, field definitions and column-mapping helpers
// for the CSV import wizard.

import { docTypes } from "@/db/schema";

export type Step = "upload" | "preview" | "done";

export interface CsvRow {
  [col: string]: string;
}

export interface FieldOption {
  key: string;
  label: string;
  required: boolean;
  hint: string;
}

export interface ImportResult {
  row: number;
  success: boolean;
  title?: string;
  error?: string;
}

export interface ApiResponse {
  total: number;
  imported: number;
  failed: number;
  results: ImportResult[];
}

// Simple CSV parser (no library needed)
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          fields.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (vals.length === 0 || vals.every((v) => !v)) continue;
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

// Field definitions
export const FIELDS: FieldOption[] = [
  { key: "title", label: "العنوان", required: true, hint: "عنوان المستند" },
  { key: "description", label: "الوصف", required: false, hint: "وصف الملف" },
  { key: "docNumber", label: "رقم المستند", required: false, hint: "رقم الملف" },
  { key: "docType", label: "التصنيف", required: false, hint: "نوع المستند (مثل: عقد، فاتورة)" },
  { key: "department", label: "القسم", required: false, hint: "اسم القسم" },
  { key: "folder", label: "المجلد", required: false, hint: "اسم المجلد" },
  { key: "status", label: "الحالة", required: false, hint: "draft / pending_review / active / archived" },
  { key: "confidential", label: "سري", required: false, hint: "yes / no" },
  { key: "tags", label: "الوسوم", required: false, hint: "مفصولة بفاصلة أو |" },
  { key: "docDate", label: "التاريخ", required: false, hint: "YYYY-MM-DD" },
];

// Auto-detect column mapping
export function guessMapping(headers: string[]): Record<string, string> {
  const known: [string, string[]][] = [
    ["title", ["title", "عنوان", "name", "اسم", "subject", "موضوع"]],
    ["description", ["description", "وصف", "desc", "ملاحظات", "notes", "details", "تفاصيل"]],
    ["docNumber", ["doc_number", "docnumber", "doc num", "رقم", "number", "رقم المستند", "document number", "ref"]],
    ["docType", ["doc_type", "doctype", "type", "نوع", "تصنيف", "document type", "category"]],
    ["department", ["department", "قسم", "dept", "ادارة", "إدارة", "جهة"]],
    ["folder", ["folder", "مجلد", "مجموعة", "group"]],
    ["status", ["status", "حالة", "وضع"]],
    ["confidential", ["confidential", "سري", "سرية", "sensitive", "classification"]],
    ["tags", ["tags", "tag", "وسوم", "وسم", "الكلمات المفتاحية", "keywords"]],
    ["docDate", ["doc_date", "docdate", "date", "تاريخ", "التاريخ", "document date", "doc date"]],
  ];

  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const hl = header.toLowerCase().trim();
    for (const [field, aliases] of known) {
      if (aliases.includes(hl) || aliases.some((a) => hl.includes(a))) {
        mapping[field] = header;
        break;
      }
    }
  }
  // Ensure title has a mapping if possible
  if (!mapping.title && headers.length > 0) {
    mapping.title = headers[0]; // first column = title
  }
  return mapping;
}

/**
 * Load all doc types in ONE batched query and build a case-insensitive
 * name → id map (Arabic + English names). Use this when resolving docType
 * names to docTypeId for many rows — it avoids one query per row (N+1).
 *
 * Server-only: pass the drizzle `db` instance from the caller (e.g. `@/db`).
 * The `db` parameter is type-only here so this module stays safe to import
 * from client components.
 */
export async function loadDocTypeIdMap(
  db: { select: typeof import("@/db").db["select"] },
): Promise<Map<string, number>> {
  const rows = await db
    .select({ id: docTypes.id, name: docTypes.name, nameEn: docTypes.nameEn })
    .from(docTypes);
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.name.toLowerCase(), r.id);
    if (r.nameEn) map.set(r.nameEn.toLowerCase(), r.id);
  }
  return map;
}
