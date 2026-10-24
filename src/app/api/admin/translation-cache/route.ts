import { z } from "zod";
import { json, parseQuery, protectedRoute } from "@/lib/http/api";
import { listCacheEntries } from "@/lib/services/translation";

const schema = z.object({
  documentId: z.string().uuid().optional(),
  targetLanguage: z.string().min(2).max(8).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = protectedRoute("translation-cache:manage", async ({ req }) => {
  const q = parseQuery(req, schema);
  return json(await listCacheEntries(q));
});
