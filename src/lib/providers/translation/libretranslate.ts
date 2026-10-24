import { TranslationProviderError, withTimeout, type TranslationProvider, type TranslateRequest } from "./types";

/** LibreTranslate (self-hostable, open source). */
export class LibreTranslateProvider implements TranslationProvider {
  readonly name = "libretranslate";
  readonly engineVersion = "v1";

  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {}

  async translate(req: TranslateRequest) {
    const { signal, clear } = withTimeout(this.timeoutMs, req.signal);
    try {
      const res = await fetch(`${this.apiUrl.replace(/\/$/, "")}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: req.segments,
          source: req.sourceLanguage,
          target: req.targetLanguage,
          format: "text",
          ...(this.apiKey ? { api_key: this.apiKey } : {}),
        }),
        signal,
      });
      if (!res.ok) throw new TranslationProviderError(`LibreTranslate a répondu ${res.status}.`);
      const data = (await res.json()) as { translatedText: string | string[] };
      const out = Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText];
      if (out.length !== req.segments.length) throw new TranslationProviderError("Réponse LibreTranslate incomplète.");
      return { translations: out };
    } catch (err) {
      if (err instanceof TranslationProviderError) throw err;
      throw new TranslationProviderError("Échec de l'appel à LibreTranslate.", err);
    } finally {
      clear();
    }
  }
}
