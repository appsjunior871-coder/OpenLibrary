import { json, route } from "@/lib/http/api";
import { Errors } from "@/lib/http/errors";
import { getDocumentForViewer } from "@/lib/services/documents";

export const GET = route<{ id: string }>(async ({ params, auth }) => {
  const doc = await getDocumentForViewer(params.id, auth?.user ?? null);
  if (!doc) throw Errors.notFound("Document introuvable.");
  return json({ document: doc });
});
