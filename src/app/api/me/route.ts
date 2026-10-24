import { json, parseJson, protectedRoute, route } from "@/lib/http/api";
import { publicUser } from "@/lib/http/serializers";
import { deleteAccountSchema, updateProfileSchema } from "@/lib/validation/auth";
import { deleteOwnAccount, updateProfile } from "@/lib/services/auth";
import { clearSessionCookie } from "@/lib/auth/session";

export const GET = route(async ({ auth }) => {
  return json({ user: auth ? publicUser(auth.user) : null });
});

export const PATCH = protectedRoute("profile:manage", async ({ req, auth }) => {
  const body = await parseJson(req, updateProfileSchema);
  const updated = await updateProfile(auth.user.id, body);
  return json({ user: publicUser(updated) });
});

export const DELETE = protectedRoute("profile:manage", async ({ req, auth }) => {
  const body = await parseJson(req, deleteAccountSchema);
  await deleteOwnAccount(auth.user.id, body.password);
  await clearSessionCookie();
  return json({ ok: true });
});
