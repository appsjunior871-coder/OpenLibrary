import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { getRequestMeta } from "@/lib/auth/session";
import { distributionSchema } from "@/lib/validation/documents";
import { setDistributionStatus, toPublicDocument } from "@/lib/services/documents";

/** Admin confirms (or refuses) that the document may be distributed under its licence. */
export const POST = protectedRoute<{ id: string }>("documents:approve-distribution", async ({ req, params, auth }) => {
  const body = await parseJson(req, distributionSchema);
  const meta = await getRequestMeta();
  const updated = await setDistributionStatus(auth.user, params.id, body.distributionStatus, body.note, meta.ip);
  return json({ document: toPublicDocument(updated) });
});
