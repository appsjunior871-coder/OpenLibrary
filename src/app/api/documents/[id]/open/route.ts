import { json, protectedRoute } from "@/lib/http/api";
import { openDocumentForUser, recordDocumentOpen, toPublicDocument, canDownload } from "@/lib/services/documents";
import { listActiveTranslationLanguages } from "@/lib/services/languages";
import { listHistory } from "@/lib/services/activity";

/**
 * POST /api/documents/:id/open
 * Step 1 of the reader flow: verifies session + access rights, records the opening,
 * and returns what the reader needs (document metadata, active languages, resume position).
 * The target language is NOT chosen here — it is chosen later, inside the reader.
 */
export const POST = protectedRoute<{ id: string }>("documents:read", async ({ params, auth }) => {
  const doc = await openDocumentForUser(params.id, auth.user);
  await recordDocumentOpen(auth.user, doc);
  const [languages, history] = await Promise.all([listActiveTranslationLanguages(), listHistory(auth.user.id, 100)]);
  const entry = history.find((h) => h.documentId === doc.id);
  return json({
    document: toPublicDocument(doc),
    fileUrl: `/api/documents/${doc.id}/file`,
    canDownload: canDownload(auth.user, doc),
    languages: languages.map((l) => ({ code: l.code, name: l.name, nativeName: l.nativeName, direction: l.direction, supportsSummary: l.supportsSummary })),
    resume: entry ? { lastPage: entry.lastPage, lastTargetLanguage: entry.lastTargetLanguage } : null,
  });
});
