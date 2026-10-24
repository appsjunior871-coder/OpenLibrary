import { json, parseJson, route } from "@/lib/http/api";
import { publicUser } from "@/lib/http/serializers";
import { loginSchema } from "@/lib/validation/auth";
import { loginUser } from "@/lib/services/auth";
import { getRequestMeta, setSessionCookie } from "@/lib/auth/session";

export const POST = route(async ({ req }) => {
  const body = await parseJson(req, loginSchema);
  const meta = await getRequestMeta();
  const { user, session } = await loginUser({ ...body, ...meta });
  await setSessionCookie(session.token, session.expiresAt);
  return json({ user: publicUser(user) });
});
