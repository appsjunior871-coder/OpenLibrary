import { TranslationProviderError, type TranslationProvider, type TranslateRequest } from "./types";

/**
 * Deterministic in-process provider for automated tests ONLY (refused in production by env validation).
 * Output is clearly marked so it can never be mistaken for a real translation.
 */
export class MockTranslationProvider implements TranslationProvider {
  readonly name = "mock";
  readonly engineVersion = "test";
  calls: TranslateRequest[] = [];
  failNext = false;

  async translate(req: TranslateRequest) {
    this.calls.push(req);
    if (this.failNext) {
      this.failNext = false;
      throw new TranslationProviderError("Mock provider failure");
    }
    return {
      translations: req.segments.map((s) => `[${req.targetLanguage}] ${s}`),
      detectedSourceLanguage: req.sourceLanguage,
    };
  }
}
