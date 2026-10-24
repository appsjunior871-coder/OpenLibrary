import { z } from "zod";
import { json, parseQuery, protectedRoute } from "@/lib/http/api";
import { REPORT_STATUSES } from "@/lib/db/schema";
import { listReports } from "@/lib/services/activity";

export const GET = protectedRoute("translation-reports:review", async ({ req }) => {
  const { status } = parseQuery(req, z.object({ status: z.enum(REPORT_STATUSES).optional() }));
  return json({ items: await listReports({ status }) });
});
