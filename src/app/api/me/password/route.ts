import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePassword } from "@/lib/services/auth";
import { clearSessionCookie, createSession, getRequestMeta, setSessionCookie } from "@/lib/auth/session";

export const POST = protectedRoute("profile:manage", async ({ req, auth }) => {
  const body = await parseJson(req, changePasswordSchema);
  await changePassword(auth.user.id, body.currentPassword, body.newPassword);
  // All sessions were revoked; issue a fresh one for the current browser.
  await clearSessionCookie();
  const meta = await getRequestMeta();
  const session = await createSession(auth.user.id, meta);
  await setSessionCookie(session.token, session.expiresAt);
  return json({ ok: true });
});
