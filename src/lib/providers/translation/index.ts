import { getEnv } from "../../env";
import { GEMINI_DEFAULT_MODEL } from "../gemini";
import { DeepLProvider } from "./deepl";
import { GeminiTranslationProvider } from "./gemini";
import { LibreTranslateProvider } from "./libretranslate";
import { MockTranslationProvider } from "./mock";
import { OpenAICompatibleTranslationProvider } from "./openai";
import type { TranslationProvider } from "./types";

export * from "./types";

let override: TranslationProvider | null | undefined;

/**
 * Returns the configured provider or null when translation is not configured.
 * Keys are read server-side only.
 */
export function getTranslationProvider(): TranslationProvider | null {
  if (override !== undefined) return override;
  const env = getEnv();
  switch (env.TRANSLATION_PROVIDER) {
    case "deepl":
      if (!env.TRANSLATION_API_KEY) return null;
      return new DeepLProvider(env.TRANSLATION_API_KEY, env.TRANSLATION_TIMEOUT_MS, env.TRANSLATION_API_URL || undefined);
    case "libretranslate":
      if (!env.TRANSLATION_API_URL) return null;
      return new LibreTranslateProvider(env.TRANSLATION_API_URL, env.TRANSLATION_API_KEY, env.TRANSLATION_TIMEOUT_MS);
    case "openai": {
      const key = env.TRANSLATION_API_KEY || env.AI_API_KEY;
      const model = env.AI_MODEL || "gpt-4o-mini";
      if (!key) return null;
      return new OpenAICompatibleTranslationProvider(
        key,
        model,
        env.TRANSLATION_TIMEOUT_MS,
        env.TRANSLATION_API_URL || env.AI_API_URL || undefined,
      );
    }
    case "gemini": {
      const sharesAiConfig = env.AI_PROVIDER === "gemini";
      const key = env.TRANSLATION_API_KEY || (sharesAiConfig ? env.AI_API_KEY : "");
      if (!key) return null;
      return new GeminiTranslationProvider(
        key,
        (sharesAiConfig && env.AI_MODEL) || GEMINI_DEFAULT_MODEL,
        env.TRANSLATION_TIMEOUT_MS,
        env.TRANSLATION_API_URL || undefined,
      );
    }
    case "mock":
      return env.NODE_ENV === "production" ? null : new MockTranslationProvider();
    case "none":
    default:
      return null;
  }
}

/** Test helper: force a provider instance (or null to simulate "not configured"). */
export function setTranslationProviderForTests(provider: TranslationProvider | null | undefined) {
  override = provider;
}

/** Human-readable, secret-free description for the admin settings page. */
export function describeTranslationConfig() {
  const env = getEnv();
  return {
    provider: env.TRANSLATION_PROVIDER,
    configured: getTranslationProvider() !== null,
    hasApiKey: Boolean(env.TRANSLATION_API_KEY),
    apiUrl: env.TRANSLATION_API_URL || null,
    maxChars: env.TRANSLATION_MAX_CHARS,
    timeoutMs: env.TRANSLATION_TIMEOUT_MS,
  };
}
