import { getEnv } from "../../env";
import { withTimeout } from "../translation/types";

/**
 * Optional OCR for scanned PDFs. Only used when explicitly configured; never
 * fabricates text. The adapter receives the whole PDF and a page number.
 */
export interface OcrProvider {
  readonly name: string;
  readonly engineVersion: string;
  recognisePage(pdf: Buffer, pageNumber: number, languageHint?: string): Promise<string>;
}

export class OcrProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OcrProviderError";
  }
}

/** OCR.space REST API (free tier available). Sends the PDF file and extracts a given page's text. */
class OcrSpaceProvider implements OcrProvider {
  readonly name = "ocrspace";
  readonly engineVersion = "v1";
  constructor(private readonly apiKey: string) {}

  async recognisePage(pdf: Buffer, pageNumber: number, languageHint?: string) {
    const { signal, clear } = withTimeout(60_000);
    try {
      const form = new FormData();
      form.append("apikey", this.apiKey);
      form.append("language", mapLang(languageHint));
      form.append("isOverlayRequired", "false");
      form.append("filetype", "PDF");
      form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), "document.pdf");
      const res = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: form, signal });
      if (!res.ok) throw new OcrProviderError(`OCR.space a répondu ${res.status}.`);
      const data = (await res.json()) as {
        IsErroredOnProcessing?: boolean;
        ErrorMessage?: string | string[];
        ParsedResults?: { ParsedText?: string }[];
      };
      if (data.IsErroredOnProcessing) throw new OcrProviderError("OCR.space a signalé une erreur de traitement.");
      const page = data.ParsedResults?.[pageNumber - 1]?.ParsedText ?? "";
      return page.trim();
    } catch (err) {
      if (err instanceof OcrProviderError) throw err;
      throw new OcrProviderError("Échec de l'appel OCR.", err);
    } finally {
      clear();
    }
  }
}

function mapLang(code?: string) {
  const map: Record<string, string> = { en: "eng", fr: "fre", es: "spa", ar: "ara", pt: "por", de: "ger", it: "ita" };
  return map[code ?? ""] ?? "eng";
}

let override: OcrProvider | null | undefined;

export function getOcrProvider(): OcrProvider | null {
  if (override !== undefined) return override;
  const env = getEnv();
  if (env.OCR_PROVIDER === "ocrspace" && env.OCR_API_KEY) return new OcrSpaceProvider(env.OCR_API_KEY);
  return null;
}

export function setOcrProviderForTests(provider: OcrProvider | null | undefined) {
  override = provider;
}
