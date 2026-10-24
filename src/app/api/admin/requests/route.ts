import { z } from "zod";
import { json, parseQuery, protectedRoute } from "@/lib/http/api";
import { REQUEST_STATUSES } from "@/lib/db/schema";
import { listAllRequests } from "@/lib/services/activity";

export const GET = protectedRoute("document-requests:review", async ({ req }) => {
  const { status } = parseQuery(req, z.object({ status: z.enum(REQUEST_STATUSES).optional() }));
  return json({ items: await listAllRequests({ status }) });
});
