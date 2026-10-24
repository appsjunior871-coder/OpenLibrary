import { TranslationProviderError, withTimeout, type TranslationProvider, type TranslateRequest } from "./types";
import { LANGUAGE_NAMES } from "../../i18n/language-names";
import { GeminiHttpError, geminiGenerateText } from "../gemini";

/**
 * Translation through the Google Gemini API. Same contract as the OpenAI
 * adapter: the model must return {"translations": [...]} with one string per segment.
 */
export class GeminiTranslationProvider implements TranslationProvider {
  readonly name = "gemini";
  readonly engineVersion: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly baseUrl?: string,
  ) {
    this.engineVersion = model;
  }

  async translate(req: TranslateRequest) {
    const { signal, clear } = withTimeout(this.timeoutMs, req.signal);
    const target = LANGUAGE_NAMES[req.targetLanguage] ?? req.targetLanguage;
    const source = req.sourceLanguage === "auto" ? "the detected language" : (LANGUAGE_NAMES[req.sourceLanguage] ?? req.sourceLanguage);
    try {
      const content = await geminiGenerateText({
        apiKey: this.apiKey,
        model: this.model,
        baseUrl: this.baseUrl,
        temperature: 0,
        json: true,
        system:
          `You are a professional academic translator. Translate each segment from ${source} to ${target}. ` +
          "Preserve meaning, terminology, numbers, citations and formatting. Do not add commentary. " +
          'Return strictly a JSON object {"translations": [ ... ]} with exactly one string per input segment, in order.',
        user: JSON.stringify({ segments: req.segments }),
        signal,
      });
      if (!content) throw new TranslationProviderError("Réponse du fournisseur vide.");
      let parsed: { translations?: unknown };
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new TranslationProviderError("Réponse du fournisseur non exploitable.");
      }
      const out = parsed.translations;
      if (!Array.isArray(out) || out.length !== req.segments.length || !out.every((s) => typeof s === "string")) {
        throw new TranslationProviderError("Le fournisseur a renvoyé un nombre de segments incorrect.");
      }
      return { translations: out as string[] };
    } catch (err) {
      if (err instanceof TranslationProviderError) throw err;
      if (err instanceof GeminiHttpError) throw new TranslationProviderError(`Le fournisseur de traduction a répondu ${err.status}.`);
      throw new TranslationProviderError("Échec de l'appel au fournisseur de traduction.", err);
    } finally {
      clear();
    }
  }
}
