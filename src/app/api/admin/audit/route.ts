import { z } from "zod";
import { json, parseQuery, protectedRoute } from "@/lib/http/api";
import { listAuditLogs } from "@/lib/services/audit";

const schema = z.object({
  action: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = protectedRoute("audit:read", async ({ req }) => {
  const q = parseQuery(req, schema);
  return json(await listAuditLogs(q));
});
