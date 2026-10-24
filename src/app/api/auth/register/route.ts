import { json, parseJson, route } from "@/lib/http/api";
import { publicUser } from "@/lib/http/serializers";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser } from "@/lib/services/auth";
import { getRequestMeta, setSessionCookie } from "@/lib/auth/session";

export const POST = route(async ({ req, auth }) => {
  if (auth) return json({ user: publicUser(auth.user) });
  const body = await parseJson(req, registerSchema);
  const meta = await getRequestMeta();
  const { user, session } = await registerUser({ ...body, ...meta });
  await setSessionCookie(session.token, session.expiresAt);
  return json({ user: publicUser(user) }, { status: 201 });
});
