export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
export const GEMINI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiHttpError extends Error {
  constructor(readonly status: number) {
    super(`Gemini HTTP ${status}`);
    this.name = "GeminiHttpError";
  }
}

export type GeminiGenerateOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  system: string;
  user: string;
  temperature: number;
  json?: boolean;
  signal?: AbortSignal;
};

/**
 * Calls the Gemini `generateContent` endpoint and returns the concatenated text
 * of the first candidate, or null when the model returned no text (e.g. blocked).
 * The key is sent in the `x-goog-api-key` header, never in the URL.
 */
export async function geminiGenerateText(opts: GeminiGenerateOptions): Promise<string | null> {
  const base = (opts.baseUrl || GEMINI_DEFAULT_BASE_URL).replace(/\/$/, "");
  const res = await fetch(`${base}/models/${encodeURIComponent(opts.model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": opts.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.user }] }],
      generationConfig: {
        temperature: opts.temperature,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new GeminiHttpError(res.status);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  return text || null;
}
