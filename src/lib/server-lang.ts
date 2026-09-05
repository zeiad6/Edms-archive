import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n";

/**
 * Server-side language: reads the `lang` cookie written by the LangProvider
 * (`ar` default). Lets server components render fully translated UI with
 * `ts(lang, "...")` from `@/lib/i18n` — same dictionary as the client.
 */
export async function getServerLang(): Promise<Lang> {
  try {
    const c = await cookies();
    return c.get("lang")?.value === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}
