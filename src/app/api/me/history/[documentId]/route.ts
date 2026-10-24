import { z } from "zod";
import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { clearHistoryEntry, updateReadingPosition } from "@/lib/services/activity";
import { openDocumentForUser } from "@/lib/services/documents";

const schema = z.object({
  lastPage: z.number().int().min(1).optional(),
  scrollPosition: z.number().min(0).max(1).nullable().optional(),
  lastTargetLanguage: z.string().min(2).max(8).nullable().optional(),
});

type P = { documentId: string };

export const PATCH = protectedRoute<P>("history:manage", async ({ req, auth, params }) => {
  const body = await parseJson(req, schema);
  await openDocumentForUser(params.documentId, auth.user); // access check
  await updateReadingPosition(auth.user.id, params.documentId, body);
  return json({ ok: true });
});

export const DELETE = protectedRoute<P>("history:manage", async ({ auth, params }) => {
  await clearHistoryEntry(auth.user.id, params.documentId);
  return json({ ok: true });
});
