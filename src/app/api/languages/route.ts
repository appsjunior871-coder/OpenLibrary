import { json, route } from "@/lib/http/api";
import { listLanguages } from "@/lib/services/languages";

/** Active languages only — disabled languages are never offered to the reader. */
export const GET = route(async () => {
  const langs = await listLanguages({ activeOnly: true });
  return json({
    items: langs.map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      direction: l.direction,
      supportsTranslation: l.supportsTranslation,
      supportsSummary: l.supportsSummary,
    })),
  });
});
