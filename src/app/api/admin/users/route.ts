import { z } from "zod";
import { json, parseQuery, protectedRoute } from "@/lib/http/api";
import { USER_ROLES, USER_STATUSES } from "@/lib/db/schema";
import { listUsers } from "@/lib/services/admin";

const schema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = protectedRoute("users:manage", async ({ req }) => {
  const q = parseQuery(req, schema);
  return json(await listUsers(q));
});
