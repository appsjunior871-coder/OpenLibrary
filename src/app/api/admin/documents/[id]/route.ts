import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { Errors } from "@/lib/http/errors";
import { getRequestMeta } from "@/lib/auth/session";
import { canEditDocument } from "@/lib/authz/permissions";
import { documentUpdateSchema } from "@/lib/validation/documents";
import { getDocumentById, toPublicDocument, updateDocumentMetadata } from "@/lib/services/documents";

type P = { id: string };

export const GET = protectedRoute<P>("admin:access", async ({ params, auth }) => {
  const doc = await getDocumentById(params.id);
  if (!doc) throw Errors.notFound("Document introuvable.");
  if (!canEditDocument(auth.user.role, auth.user.id, doc.createdBy)) throw Errors.forbidden();
  return json({ document: toPublicDocument(doc) });
});

export const PATCH = protectedRoute<P>("admin:access", async ({ req, params, auth }) => {
  const body = await parseJson(req, documentUpdateSchema);
  const meta = await getRequestMeta();
  const updated = await updateDocumentMetadata(auth.user, params.id, body, meta.ip);
  return json({ document: toPublicDocument(updated) });
});
