import { cookies } from "next/headers";
import { cache } from "react";
import { getCurrentUser } from "../auth/session";
import { DEFAULT_LOCALE, getDictionary, UI_LOCALES, type UiLocale } from "./dictionaries";

export const UI_LOCALE_COOKIE = "ol_locale";

/** UI locale resolution: user preference → cookie → default. */
export const getUiLocale = cache(async (): Promise<UiLocale> => {
  const user = await getCurrentUser();
  const pref = user?.preferences?.uiLocale;
  if (pref && (UI_LOCALES as readonly string[]).includes(pref)) return pref;
  const store = await cookies();
  const c = store.get(UI_LOCALE_COOKIE)?.value;
  if (c && (UI_LOCALES as readonly string[]).includes(c)) return c as UiLocale;
  return DEFAULT_LOCALE;
});

export async function getT() {
  const locale = await getUiLocale();
  return { locale, t: getDictionary(locale) };
}
