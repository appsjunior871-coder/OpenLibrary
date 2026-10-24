import { cookies } from "next/headers";
import { json, route } from "@/lib/http/api";
import { clearSessionCookie, destroySessionByToken, SESSION_COOKIE } from "@/lib/auth/session";

export const POST = route(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySessionByToken(token);
  await clearSessionCookie();
  return json({ ok: true });
});
