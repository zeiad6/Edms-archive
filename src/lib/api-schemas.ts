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

export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete"),
    ids: z
      .array(z.number())
      .min(1, "لا توجد مستندات محددة"),
  }),
  z.object({
    action: z.literal("status"),
    ids: z
      .array(z.number())
      .min(1, "لا توجد مستندات محددة"),
    status: z.enum(["draft", "pending_review", "active", "archived"], "حالة غير صالحة"),
  }),
  z.object({
    action: z.literal("tag"),
    ids: z
      .array(z.number())
      .min(1, "لا توجد مستندات محددة"),
    tagId: z.number({ message: "رقم الوسم مطلوب" }),
  }),
]);
