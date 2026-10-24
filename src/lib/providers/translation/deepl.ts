import { TranslationProviderError, withTimeout, type TranslationProvider, type TranslateRequest } from "./types";

/** DeepL REST API v2 (free keys end with ":fx" and use api-free.deepl.com). */
export class DeepLProvider implements TranslationProvider {
  readonly name = "deepl";
  readonly engineVersion = "v2";

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    apiUrl?: string,
  ) {
    this.baseUrl = apiUrl || (apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");
  }

  private readonly baseUrl: string;

  async translate(req: TranslateRequest) {
    const { signal, clear } = withTimeout(this.timeoutMs, req.signal);
    try {
      const res = await fetch(`${this.baseUrl}/v2/translate`, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: req.segments,
          target_lang: toDeepL(req.targetLanguage),
          ...(req.sourceLanguage !== "auto" ? { source_lang: toDeepL(req.sourceLanguage) } : {}),
          preserve_formatting: true,
        }),
        signal,
      });
      if (!res.ok) {
        throw new TranslationProviderError(`DeepL a répondu ${res.status}.`);
      }
      const data = (await res.json()) as { translations: { text: string; detected_source_language?: string }[] };
      if (!Array.isArray(data.translations) || data.translations.length !== req.segments.length) {
        throw new TranslationProviderError("Réponse DeepL incomplète.");
      }
      return {
        translations: data.translations.map((t) => t.text),
        detectedSourceLanguage: data.translations[0]?.detected_source_language?.toLowerCase(),
      };
    } catch (err) {
      if (err instanceof TranslationProviderError) throw err;
      throw new TranslationProviderError("Échec de l'appel à DeepL.", err);
    } finally {
      clear();
    }
  }
}

function toDeepL(code: string) {
  const c = code.toLowerCase();
  if (c === "en") return "EN-GB";
  if (c === "pt") return "PT-PT";
  return c.toUpperCase();
}
