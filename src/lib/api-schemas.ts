import { z } from "zod";
import type { NextRequest } from "next/server";

export type SafeParseResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Parse `await req.json()` safely with a Zod schema.
 * Returns a discriminated union — check `result.success` to narrow.
 */
export async function safeParseJson<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>,
): Promise<SafeParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { success: false, error: "بيان JSON غير صالح" };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.length ? `${first.path.join(".")}: ` : "";
    return { success: false, error: `${path}${first.message}` };
  }
  return { success: true, data: result.data };
}

// ── Document Types ───────────────────────────────────────────────

export const createDocTypeSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  nameEn: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const updateDocTypeSchema = z.object({
  id: z.number({ message: "المعرف مطلوب" }),
  name: z.string().optional(),
  nameEn: z
    .string()
    .nullable()
    .optional(),
  color: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const deleteDocTypeSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
});

// ── Bulk Actions ─────────────────────────────────────────────────

/**
 * Upper bound on a single bulk request.
 *
 * The ids array goes straight into `inArray(documents.id, ids)`, so every
 * element becomes a bound parameter in one statement. SQLite caps bound
 * parameters per statement (SQLITE_MAX_VARIABLE_NUMBER — 999 on older builds,
 * 32766 on newer), so an unbounded array either blows past the cap and
 * surfaces as a raw driver error, or becomes a memory/latency DoS below it.
 * The sibling export routes already cap at 50; bulk matches that ceiling.
 */
export const MAX_BULK_DOCS = 200;

const bulkIds = z
  .array(z.number().int().positive())
  .min(1, "لا توجد مستندات محددة")
  .max(MAX_BULK_DOCS, `الحد الأقصى ${MAX_BULK_DOCS} مستنداً في العملية الواحدة`);

export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete"),
    ids: bulkIds,
  }),
  z.object({
    action: z.literal("status"),
    ids: bulkIds,
    status: z.enum(["draft", "pending_review", "active", "archived"], "حالة غير صالحة"),
  }),
  z.object({
    action: z.literal("tag"),
    ids: bulkIds,
    tagId: z.number({ message: "رقم الوسم مطلوب" }),
  }),
]);
