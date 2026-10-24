import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { summarySchema } from "@/lib/validation/activity";
import { summarizeRange } from "@/lib/services/summary";

export const POST = protectedRoute("summaries:use", async ({ req, auth }) => {
  const body = await parseJson(req, summarySchema);
  const result = await summarizeRange({ user: auth.user, ...body });
  return json(result);
});
