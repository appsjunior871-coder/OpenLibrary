import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { TranslatePageResult } from "@/lib/services/translation";
import type { SummaryResult } from "@/lib/services/summary";

export type ReaderLanguage = {
  code: string;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  supportsSummary: boolean;
};

export type OpenResponse = {
  document: {
    id: string;
    title: string;
    author: string;
    sourceLanguage: string;
    pageCount: number;
    hasTextLayer: boolean | null;
    license: string;
  };
  fileUrl: string;
  canDownload: boolean;
  languages: ReaderLanguage[];
  resume: { lastPage: number; lastTargetLanguage: string | null } | null;
};

export type ApiErrorBody = {
  error: { code: string; message: string; details: { retryAfterSeconds?: number } | null };
};

export type TranslationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: TranslatePageResult }
  | { status: "error"; code: string; message: string; retryAfterSeconds?: number };

export type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: SummaryResult }
  | { status: "error"; code: string; message: string };

export type ReaderDictionary = { reader: Dictionary["reader"]; common: Dictionary["common"] };

export async function readApiError(res: Response): Promise<{ code: string; message: string; retryAfterSeconds?: number }> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return {
    code: body?.error.code ?? `http_${res.status}`,
    message: body?.error.message ?? "Une erreur est survenue.",
    retryAfterSeconds: body?.error.details?.retryAfterSeconds,
  };
}
