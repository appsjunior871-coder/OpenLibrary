import { json, protectedRoute } from "@/lib/http/api";
import { getEnv } from "@/lib/env";
import { describeTranslationConfig } from "@/lib/providers/translation";
import { describeAiConfig } from "@/lib/providers/ai";
import { getDbHandle } from "@/lib/db/client";

/** Read-only, secret-free view of the external services configuration. */
export const GET = protectedRoute("settings:read", async () => {
  const env = getEnv();
  const db = await getDbHandle();
  return json({
    database: { kind: db.kind },
    storage: { provider: env.STORAGE_PROVIDER, maxUploadBytes: env.MAX_UPLOAD_BYTES },
    translation: describeTranslationConfig(),
    ai: describeAiConfig(),
    ocr: { provider: env.OCR_PROVIDER, configured: env.OCR_PROVIDER !== "none" && Boolean(env.OCR_API_KEY) },
    limits: {
      translationsPerHour: env.RATE_LIMIT_TRANSLATIONS_PER_HOUR,
      summariesPerHour: env.RATE_LIMIT_SUMMARIES_PER_HOUR,
      loginPer15Min: env.RATE_LIMIT_LOGIN_PER_15MIN,
    },
  });
});
