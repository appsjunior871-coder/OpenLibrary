import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { getAiProvider } from "@/lib/providers/ai";
import { getTranslationProvider, TranslationProviderError } from "@/lib/providers/translation";

const FAKE_KEY = "fake-gemini-key-for-tests";

function geminiResponse(text: string, status = 200) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function useGeminiEnv(vars: Record<string, string>) {
  Object.assign(process.env, vars);
  resetEnvCache();
}

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.TRANSLATION_PROVIDER = "mock";
  process.env.AI_PROVIDER = "mock";
  delete process.env.TRANSLATION_API_KEY;
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  resetEnvCache();
});

describe("Fournisseur Gemini", () => {
  it("n'est pas configuré sans clé", () => {
    useGeminiEnv({ TRANSLATION_PROVIDER: "gemini", AI_PROVIDER: "gemini" });
    expect(getTranslationProvider()).toBeNull();
    expect(getAiProvider()).toBeNull();
  });

  it("traduit via generateContent avec la clé en en-tête", async () => {
    useGeminiEnv({ TRANSLATION_PROVIDER: "gemini", AI_PROVIDER: "gemini", AI_API_KEY: FAKE_KEY });
    const fetchMock = vi.fn(async () => geminiResponse(JSON.stringify({ translations: ["Bonjour", "Monde"] })));
    vi.stubGlobal("fetch", fetchMock);

    const provider = getTranslationProvider()!;
    expect(provider.name).toBe("gemini");
    expect(provider.engineVersion).toBe("gemini-2.5-flash");
    const result = await provider.translate({ segments: ["Hello", "World"], sourceLanguage: "en", targetLanguage: "fr" });
    expect(result.translations).toEqual(["Bonjour", "Monde"]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(url).not.toContain(FAKE_KEY);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(FAKE_KEY);
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({ segments: ["Hello", "World"] });
  });

  it("ne réutilise pas AI_MODEL d'un autre fournisseur pour la traduction", () => {
    useGeminiEnv({ TRANSLATION_PROVIDER: "gemini", AI_PROVIDER: "openai", AI_MODEL: "gpt-4o-mini", TRANSLATION_API_KEY: FAKE_KEY });
    expect(getTranslationProvider()!.engineVersion).toBe("gemini-2.5-flash");
  });

  it("rejette un nombre de segments incorrect et masque les erreurs HTTP", async () => {
    useGeminiEnv({ TRANSLATION_PROVIDER: "gemini", TRANSLATION_API_KEY: FAKE_KEY });
    const provider = getTranslationProvider()!;
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(JSON.stringify({ translations: ["Seul"] }))));
    await expect(provider.translate({ segments: ["A", "B"], sourceLanguage: "en", targetLanguage: "fr" })).rejects.toThrow(
      TranslationProviderError,
    );
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    await expect(provider.translate({ segments: ["A"], sourceLanguage: "en", targetLanguage: "fr" })).rejects.toThrow(
      "Le fournisseur de traduction a répondu 403.",
    );
  });

  it("résume avec le modèle configuré", async () => {
    useGeminiEnv({ AI_PROVIDER: "gemini", AI_API_KEY: FAKE_KEY, AI_MODEL: "gemini-2.5-pro" });
    const fetchMock = vi.fn(async () => geminiResponse("  Résumé fidèle.  "));
    vi.stubGlobal("fetch", fetchMock);

    const provider = getAiProvider()!;
    const { summary } = await provider.summarize({ text: "Body", language: "fr", documentTitle: "T", pageRange: { start: 1, end: 2 } });
    expect(summary).toBe("Résumé fidèle.");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/models/gemini-2.5-pro:generateContent");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toMatch(/Never invent/);
    expect(body.generationConfig.responseMimeType).toBeUndefined();
  });
});
