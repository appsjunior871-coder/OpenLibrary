import { z } from "zod";
import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { getRequestMeta } from "@/lib/auth/session";
import { USER_ROLES } from "@/lib/db/schema";
import { setUserRole, setUserStatus } from "@/lib/services/admin";

const schema = z
  .object({
    status: z.enum(["active", "suspended"]).optional(),
    role: z.enum(USER_ROLES).optional(),
  })
  .refine((d) => d.status !== undefined || d.role !== undefined, { message: "Aucune modification fournie." });

export const PATCH = protectedRoute<{ id: string }>("users:manage", async ({ req, params, auth }) => {
  const body = await parseJson(req, schema);
  const meta = await getRequestMeta();
  if (body.status) await setUserStatus(auth.user, params.id, body.status, meta.ip);
  if (body.role) await setUserRole(auth.user, params.id, body.role, meta.ip);
  return json({ ok: true });
});
