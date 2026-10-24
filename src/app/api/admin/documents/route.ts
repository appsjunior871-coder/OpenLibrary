import { z } from "zod";
import { json, parseQuery, protectedRoute } from "@/lib/http/api";
import { Errors } from "@/lib/http/errors";
import { getRequestMeta } from "@/lib/auth/session";
import { DOCUMENT_STATUSES } from "@/lib/db/schema";
import { documentMetadataSchema } from "@/lib/validation/documents";
import { createDocument, listDocumentsForStaff } from "@/lib/services/documents";
import { getEnv } from "@/lib/env";

const listSchema = z.object({
  status: z.enum(DOCUMENT_STATUSES).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = protectedRoute("admin:access", async ({ req, auth }) => {
  const q = parseQuery(req, listSchema);
  return json(await listDocumentsForStaff(auth.user, q));
});

/**
 * POST /api/admin/documents — multipart/form-data: metadata fields + `file` (PDF).
 * Creates a DRAFT with distribution pending review. Publishing is a separate, audited step.
 */
export const POST = protectedRoute("documents:create", async ({ req, auth }) => {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > getEnv().MAX_UPLOAD_BYTES + 64 * 1024) {
    throw Errors.payloadTooLarge("Le fichier dépasse la taille maximale autorisée.");
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw Errors.badRequest("Formulaire multipart invalide.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw Errors.badRequest("Fichier PDF manquant.");
  if (file.type && file.type !== "application/pdf" && file.type !== "application/x-pdf") {
    throw Errors.badRequest("Seuls les fichiers PDF sont acceptés.");
  }
  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (k === "file") continue;
    if (typeof v === "string") raw[k] = k === "keywords" ? v : v;
  }
  if (typeof raw.allowDownload === "string") raw.allowDownload = raw.allowDownload === "true" || raw.allowDownload === "on";
  const parsed = documentMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    throw Errors.validation(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const meta = await getRequestMeta();
  const created = await createDocument(auth.user, parsed.data, buffer, meta.ip);
  const { storageKey: _k, checksum: _c, ...safe } = created;
  return json({ document: safe }, { status: 201 });
});
