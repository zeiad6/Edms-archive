import { z } from "zod";

/**
 * Central env validation — import at boot (e.g. `src/lib/session.ts`)
 * so misconfiguration fails fast with a clear message.
 *
 * - Production: AUTH_SECRET required, min 32 chars (fail-fast).
 * - Dev/test: optional in env.ts, but session.ts fail-fasts unless NODE_ENV=test.
 * - DATABASE_URL / TESSERACT_SRC / TESSERACT_PATH optional.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  AUTH_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).default("file:./data/edms.db"),
  TESSERACT_SRC: z.string().min(1).optional(),
  TESSERACT_PATH: z.string().min(1).optional(),
});

type RawEnv = z.infer<typeof EnvSchema>;

function validateEnv(raw: NodeJS.ProcessEnv): RawEnv & { AUTH_SECRET?: string } {
  const parsed = EnvSchema.parse({
    NODE_ENV: raw.NODE_ENV,
    AUTH_SECRET: raw.AUTH_SECRET?.trim() || undefined,
    DATABASE_URL: raw.DATABASE_URL || undefined,
    TESSERACT_SRC: raw.TESSERACT_SRC || undefined,
    TESSERACT_PATH: raw.TESSERACT_PATH || undefined,
  });

  const isProd = parsed.NODE_ENV === "production";
  if (isProd) {
    if (!parsed.AUTH_SECRET || parsed.AUTH_SECRET.length < 32) {
      throw new Error(
        "[env] AUTH_SECRET must be set in production with ≥32 chars. Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
      );
    }
  } else if (parsed.AUTH_SECRET && parsed.AUTH_SECRET.length < 32) {
    console.warn(
      "[env] AUTH_SECRET shorter than 32 chars — OK in dev/test only, must be ≥32 in production."
    );
  }
  return parsed;
}

export const env = validateEnv(process.env);
export type Env = typeof env;
