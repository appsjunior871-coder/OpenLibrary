import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { translateSchema } from "@/lib/validation/activity";
import { translatePage } from "@/lib/services/translation";

/**
 * POST /api/translations
 * Translates ONE page of a document the user may access, into an active target language.
 * The PDF is never modified: the response is a comprehension layer (segments).
 */
export const POST = protectedRoute("translations:use", async ({ req, auth }) => {
  const body = await parseJson(req, translateSchema);
  const result = await translatePage({ user: auth.user, ...body });
  return json(result);
});
