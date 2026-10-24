/** English names used in prompts sent to language-model providers. */
export const LANGUAGE_NAMES: Record<string, string> = {
  fr: "French",
  en: "English",
  es: "Spanish",
  ar: "Arabic",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  zh: "Chinese",
  ru: "Russian",
  tr: "Turkish",
  nl: "Dutch",
  ja: "Japanese",
};

export const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

export function directionFor(code: string): "ltr" | "rtl" {
  return RTL_LANGUAGES.has(code.toLowerCase()) ? "rtl" : "ltr";
}
