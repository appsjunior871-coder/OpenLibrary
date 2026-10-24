import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { translationReportSchema } from "@/lib/validation/activity";
import { createTranslationReport } from "@/lib/services/activity";
import { openDocumentForUser } from "@/lib/services/documents";

export const POST = protectedRoute("translation-reports:create", async ({ req, auth }) => {
  const body = await parseJson(req, translationReportSchema);
  await openDocumentForUser(body.documentId, auth.user); // must have access to report
  const created = await createTranslationReport(auth.user, body);
  return json({ report: created }, { status: 201 });
});
