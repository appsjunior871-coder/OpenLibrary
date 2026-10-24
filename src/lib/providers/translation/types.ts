export type TranslateRequest = {
  segments: string[];
  sourceLanguage: string; // ISO 639-1 (e.g. "en"); "auto" allowed by some providers
  targetLanguage: string;
  signal?: AbortSignal;
};

export type TranslateResult = {
  translations: string[]; // same length/order as request.segments
  detectedSourceLanguage?: string;
};

export interface TranslationProvider {
  /** Stable identifier stored in the cache (e.g. "deepl"). */
  readonly name: string;
  /** Bump when output semantics change so cache entries are naturally segregated. */
  readonly engineVersion: string;
  translate(req: TranslateRequest): Promise<TranslateResult>;
}

export class TranslationProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TranslationProviderError";
  }
}

export function withTimeout(timeoutMs: number, parent?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  parent?.addEventListener("abort", () => controller.abort(parent.reason), { once: true });
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
