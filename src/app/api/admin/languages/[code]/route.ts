import { z } from "zod";
import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { updateLanguage } from "@/lib/services/languages";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  supportsTranslation: z.boolean().optional(),
  supportsSummary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  name: z.string().trim().min(2).max(60).optional(),
  nativeName: z.string().trim().min(1).max(60).optional(),
});

export const PATCH = protectedRoute<{ code: string }>("languages:manage", async ({ req, params, auth }) => {
  const body = await parseJson(req, patchSchema);
  const updated = await updateLanguage(auth.user.id, params.code, body);
  return json({ language: updated });
});
