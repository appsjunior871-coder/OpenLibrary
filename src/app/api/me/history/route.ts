import { json, protectedRoute } from "@/lib/http/api";
import { listHistory } from "@/lib/services/activity";

export const GET = protectedRoute("history:manage", async ({ auth }) => {
  return json({ items: await listHistory(auth.user.id, 50) });
});
