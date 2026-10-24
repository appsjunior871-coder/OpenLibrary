import { z } from "zod";

/**
 * Centralised, validated access to environment variables.
 * Secrets never leave the server: this module must only be imported from server code.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default("pglite://./.data/pglite"),
  AUTH_SECRET: z.string().min(16).default("insecure-dev-secret-change-me-please-32chars"),

  STORAGE_PROVIDER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage/documents"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),

  TRANSLATION_PROVIDER: z.enum(["none", "deepl", "libretranslate", "openai", "gemini", "mock"]).default("none"),
  TRANSLATION_API_KEY: z.string().optional().default(""),
  TRANSLATION_API_URL: z.string().optional().default(""),
  TRANSLATION_MAX_CHARS: z.coerce.number().int().positive().default(6000),
  TRANSLATION_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),

  AI_PROVIDER: z.enum(["none", "openai", "anthropic", "gemini", "mock"]).default("none"),
  AI_API_KEY: z.string().optional().default(""),
  AI_API_URL: z.string().optional().default(""),
  AI_MODEL: z.string().optional().default(""),
  SUMMARY_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(24000),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),

  OCR_PROVIDER: z.enum(["none", "ocrspace"]).default("none"),
  OCR_API_KEY: z.string().optional().default(""),

  RATE_LIMIT_TRANSLATIONS_PER_HOUR: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_SUMMARIES_PER_HOUR: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_LOGIN_PER_15MIN: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuration invalide: ${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (env.AUTH_SECRET.startsWith("insecure-dev-secret") || env.AUTH_SECRET.length < 32) {
      throw new Error("AUTH_SECRET doit être défini (>= 32 caractères) en production.");
    }
    if (env.TRANSLATION_PROVIDER === "mock" || env.AI_PROVIDER === "mock") {
      throw new Error("Les fournisseurs 'mock' sont interdits en production.");
    }
  }
  cached = env;
  return env;
}

/** Test helper: reset the cache after mutating process.env. */
export function resetEnvCache() {
  cached = null;
}

export const isProduction = () => getEnv().NODE_ENV === "production";
