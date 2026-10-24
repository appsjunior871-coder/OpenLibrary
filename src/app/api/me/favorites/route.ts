import { z } from "zod";
import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { addFavorite, listFavorites } from "@/lib/services/activity";

export const GET = protectedRoute("favorites:manage", async ({ auth }) => {
  return json({ items: await listFavorites(auth.user.id) });
});

export const POST = protectedRoute("favorites:manage", async ({ req, auth }) => {
  const { documentId } = await parseJson(req, z.object({ documentId: z.string().uuid() }));
  await addFavorite(auth.user.id, documentId);
  return json({ ok: true }, { status: 201 });
});
