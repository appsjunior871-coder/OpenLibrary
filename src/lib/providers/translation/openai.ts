import { TranslationProviderError, withTimeout, type TranslationProvider, type TranslateRequest } from "./types";
import { LANGUAGE_NAMES } from "../../i18n/language-names";

/**
 * Translation through any OpenAI-compatible chat completion endpoint
 * (OpenAI, Mistral, Groq, Together, Ollama…). Segments are numbered and the
 * model must return a JSON array of the same length.
 */
export class OpenAICompatibleTranslationProvider implements TranslationProvider {
  readonly name: string;
  readonly engineVersion: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {
    this.name = "openai";
    this.engineVersion = model;
  }

  async translate(req: TranslateRequest) {
    const { signal, clear } = withTimeout(this.timeoutMs, req.signal);
    const target = LANGUAGE_NAMES[req.targetLanguage] ?? req.targetLanguage;
    const source = req.sourceLanguage === "auto" ? "the detected language" : (LANGUAGE_NAMES[req.sourceLanguage] ?? req.sourceLanguage);
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                `You are a professional academic translator. Translate each segment from ${source} to ${target}. ` +
                "Preserve meaning, terminology, numbers, citations and formatting. Do not add commentary. " +
                'Return strictly a JSON object {"translations": [ ... ]} with exactly one string per input segment, in order.',
            },
            { role: "user", content: JSON.stringify({ segments: req.segments }) },
          ],
        }),
        signal,
      });
      if (!res.ok) throw new TranslationProviderError(`Le fournisseur de traduction a répondu ${res.status}.`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
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
      throw new TranslationProviderError("Échec de l'appel au fournisseur de traduction.", err);
    } finally {
      clear();
    }
  }
}
