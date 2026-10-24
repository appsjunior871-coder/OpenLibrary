import { json, protectedRoute } from "@/lib/http/api";
import { removeFavorite } from "@/lib/services/activity";

export const DELETE = protectedRoute<{ documentId: string }>("favorites:manage", async ({ auth, params }) => {
  await removeFavorite(auth.user.id, params.documentId);
  return json({ ok: true });
});
