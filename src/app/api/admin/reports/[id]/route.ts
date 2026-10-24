import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { getRequestMeta } from "@/lib/auth/session";
import { updateReportSchema } from "@/lib/validation/activity";
import { updateReportStatus } from "@/lib/services/activity";

export const PATCH = protectedRoute<{ id: string }>("translation-reports:review", async ({ req, params, auth }) => {
  const body = await parseJson(req, updateReportSchema);
  const meta = await getRequestMeta();
  const updated = await updateReportStatus(auth.user, params.id, body.status, body.response, meta.ip);
  return json({ report: updated });
});
