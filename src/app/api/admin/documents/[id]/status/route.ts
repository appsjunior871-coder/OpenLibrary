import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { getRequestMeta } from "@/lib/auth/session";
import { documentStatusSchema } from "@/lib/validation/documents";
import { setDocumentStatus, toPublicDocument } from "@/lib/services/documents";

/** Publish / archive / remove / back to draft. Publication enforces the licence rule. */
export const POST = protectedRoute<{ id: string }>("admin:access", async ({ req, params, auth }) => {
  const { status } = await parseJson(req, documentStatusSchema);
  const meta = await getRequestMeta();
  const updated = await setDocumentStatus(auth.user, params.id, status, meta.ip);
  return json({ document: toPublicDocument(updated) });
});
