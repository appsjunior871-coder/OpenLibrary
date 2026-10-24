import { z } from "zod";
import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { getRequestMeta } from "@/lib/auth/session";
import { invalidateCache } from "@/lib/services/translation";
import { invalidateSummaries } from "@/lib/services/summary";

const schema = z.object({
  ids: z.array(z.string().uuid()).max(500).optional(),
  documentId: z.string().uuid().optional(),
  pageNumber: z.number().int().min(1).optional(),
  targetLanguage: z.string().min(2).max(8).optional(),
  includeSummaries: z.boolean().default(false),
});

export const POST = protectedRoute("translation-cache:manage", async ({ req, auth }) => {
  const body = await parseJson(req, schema);
  const meta = await getRequestMeta();
  const { includeSummaries, ...target } = body;
  const invalidated = await invalidateCache(auth.user, target, meta.ip);
  let summariesInvalidated = 0;
  if (includeSummaries && body.documentId) summariesInvalidated = await invalidateSummaries(auth.user, body.documentId);
  return json({ invalidated, summariesInvalidated });
});
