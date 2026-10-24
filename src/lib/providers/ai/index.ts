import { getEnv } from "../../env";
import { LANGUAGE_NAMES } from "../../i18n/language-names";
import { GEMINI_DEFAULT_MODEL, GeminiHttpError, geminiGenerateText } from "../gemini";
import { withTimeout } from "../translation/types";

export type SummaryRequest = {
  text: string;
  language: string; // output language code
  documentTitle: string;
  pageRange: { start: number; end: number };
  signal?: AbortSignal;
};

export type SummaryResult = { summary: string };

export interface AiProvider {
  readonly name: string;
  readonly engineVersion: string;
  summarize(req: SummaryRequest): Promise<SummaryResult>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export function buildSummaryPrompt(req: SummaryRequest) {
  const lang = LANGUAGE_NAMES[req.language] ?? req.language;
  const system =
    "You are an academic reading assistant. Summarise ONLY what is present in the provided excerpt of a document. " +
    "Never invent chapters, references, citations, authors or results that do not appear in the text. " +
    "If the excerpt is partial, truncated or unclear, say so explicitly in a final line starting with 'Limites :'. " +
    `Write the summary in ${lang}. Use short paragraphs and, when useful, a bullet list of key points. ` +
    "Target length: 150–300 words.";
  const user =
    `Document: "${req.documentTitle}" — pages ${req.pageRange.start} to ${req.pageRange.end}.\n\n` +
    `Excerpt:\n"""\n${req.text}\n"""`;
  return { system, user };
}

class OpenAICompatibleAiProvider implements AiProvider {
  readonly name = "openai";
  readonly engineVersion: string;
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {
    this.engineVersion = model;
  }

  async summarize(req: SummaryRequest) {
    const { system, user } = buildSummaryPrompt(req);
    const { signal, clear } = withTimeout(this.timeoutMs, req.signal);
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal,
      });
      if (!res.ok) throw new AiProviderError(`Le fournisseur d'IA a répondu ${res.status}.`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new AiProviderError("Réponse du fournisseur d'IA vide.");
      return { summary: content };
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError("Échec de l'appel au fournisseur d'IA.", err);
    } finally {
      clear();
    }
  }
}

class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic";
  readonly engineVersion: string;
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly baseUrl = "https://api.anthropic.com",
  ) {
    this.engineVersion = model;
  }

  async summarize(req: SummaryRequest) {
    const { system, user } = buildSummaryPrompt(req);
    const { signal, clear } = withTimeout(this.timeoutMs, req.signal);
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal,
      });
      if (!res.ok) throw new AiProviderError(`Le fournisseur d'IA a répondu ${res.status}.`);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const content = data.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n")
        .trim();
      if (!content) throw new AiProviderError("Réponse du fournisseur d'IA vide.");
      return { summary: content };
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError("Échec de l'appel au fournisseur d'IA.", err);
    } finally {
      clear();
    }
  }
}

class GeminiAiProvider implements AiProvider {
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

  async summarize(req: SummaryRequest) {
    const { system, user } = buildSummaryPrompt(req);
    const { signal, clear } = withTimeout(this.timeoutMs, req.signal);
    try {
      const content = await geminiGenerateText({
        apiKey: this.apiKey,
        model: this.model,
        baseUrl: this.baseUrl,
        temperature: 0.2,
        system,
        user,
        signal,
      });
      if (!content) throw new AiProviderError("Réponse du fournisseur d'IA vide.");
      return { summary: content };
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      if (err instanceof GeminiHttpError) throw new AiProviderError(`Le fournisseur d'IA a répondu ${err.status}.`);
      throw new AiProviderError("Échec de l'appel au fournisseur d'IA.", err);
    } finally {
      clear();
    }
  }
}

/** Test-only provider. Output is explicitly marked as a mock. */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly engineVersion = "test";
  calls: SummaryRequest[] = [];
  failNext = false;
  async summarize(req: SummaryRequest) {
    this.calls.push(req);
    if (this.failNext) {
      this.failNext = false;
      throw new AiProviderError("Mock AI failure");
    }
    return { summary: `[mock summary ${req.language} p${req.pageRange.start}-${req.pageRange.end}] ${req.text.slice(0, 80)}` };
  }
}

let override: AiProvider | null | undefined;

export function getAiProvider(): AiProvider | null {
  if (override !== undefined) return override;
  const env = getEnv();
  switch (env.AI_PROVIDER) {
    case "openai":
      if (!env.AI_API_KEY) return null;
      return new OpenAICompatibleAiProvider(env.AI_API_KEY, env.AI_MODEL || "gpt-4o-mini", env.AI_TIMEOUT_MS, env.AI_API_URL || undefined);
    case "anthropic":
      if (!env.AI_API_KEY) return null;
      return new AnthropicAiProvider(env.AI_API_KEY, env.AI_MODEL || "claude-3-5-haiku-latest", env.AI_TIMEOUT_MS, env.AI_API_URL || undefined);
    case "gemini":
      if (!env.AI_API_KEY) return null;
      return new GeminiAiProvider(env.AI_API_KEY, env.AI_MODEL || GEMINI_DEFAULT_MODEL, env.AI_TIMEOUT_MS, env.AI_API_URL || undefined);
    case "mock":
      return env.NODE_ENV === "production" ? null : new MockAiProvider();
    case "none":
    default:
      return null;
  }
}

export function setAiProviderForTests(provider: AiProvider | null | undefined) {
  override = provider;
}

export function describeAiConfig() {
  const env = getEnv();
  return {
    provider: env.AI_PROVIDER,
    configured: getAiProvider() !== null,
    hasApiKey: Boolean(env.AI_API_KEY),
    model: env.AI_MODEL || null,
    apiUrl: env.AI_API_URL || null,
    maxInputChars: env.SUMMARY_MAX_INPUT_CHARS,
    timeoutMs: env.AI_TIMEOUT_MS,
  };
}
