import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { getRequestMeta } from "@/lib/auth/session";
import { resolveRequestSchema } from "@/lib/validation/activity";
import { resolveRequest } from "@/lib/services/activity";

export const PATCH = protectedRoute<{ id: string }>("document-requests:review", async ({ req, params, auth }) => {
  const body = await parseJson(req, resolveRequestSchema);
  const meta = await getRequestMeta();
  const updated = await resolveRequest(auth.user, params.id, body.status, body.response, meta.ip);
  return json({ request: updated });
});
