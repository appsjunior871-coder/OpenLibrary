import { json, parseQuery, route } from "@/lib/http/api";
import { catalogQuerySchema } from "@/lib/validation/documents";
import { searchCatalog } from "@/lib/services/documents";

/** Public catalogue search. Visitors only ever see published, approved documents. */
export const GET = route(async ({ req, auth }) => {
  const query = parseQuery(req, catalogQuerySchema);
  const result = await searchCatalog(query, auth?.user ?? null);
  return json(result);
});
