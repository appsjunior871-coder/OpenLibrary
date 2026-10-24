import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { documentRequestSchema } from "@/lib/validation/activity";
import { createDocumentRequest, listOwnRequests } from "@/lib/services/activity";

export const GET = protectedRoute("document-requests:create", async ({ auth }) => {
  return json({ items: await listOwnRequests(auth.user.id) });
});

export const POST = protectedRoute("document-requests:create", async ({ req, auth }) => {
  const body = await parseJson(req, documentRequestSchema);
  const created = await createDocumentRequest(auth.user.id, body);
  return json({ request: created }, { status: 201 });
});
