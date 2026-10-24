import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http/api";
import { Errors } from "@/lib/http/errors";
import { getAuth } from "@/lib/auth/session";
import { canDownload, openDocumentForUser, recordDocumentDownload } from "@/lib/services/documents";
import { getStorage } from "@/lib/providers/storage";

/**
 * GET /api/documents/:id/file
 * Streams the private PDF to an authorised user. Supports HTTP Range so pdf.js can
 * fetch lazily. `?download=1` forces an attachment and requires download rights.
 * Visitors (no session) always receive 401 — the file is never public.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuth();
    if (!auth) throw Errors.unauthorized();
    const doc = await openDocumentForUser(id, auth.user);
    const download = req.nextUrl.searchParams.get("download") === "1";
    if (download && !canDownload(auth.user, doc)) {
      throw Errors.forbidden("Le téléchargement de ce document n'est pas autorisé.");
    }
    const storage = getStorage();
    if (!(await storage.exists(doc.storageKey))) throw Errors.notFound("Fichier introuvable.");

    const size = doc.fileSize;
    const filename = `${doc.title.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 80) || "document"}.pdf`;
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    };

    const range = req.headers.get("range");
    if (range && !download) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
        if (start <= end && start < size) {
          const stream = await storage.stream(doc.storageKey, { start, end });
          return new Response(stream, {
            status: 206,
            headers: {
              ...baseHeaders,
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Content-Length": String(end - start + 1),
            },
          });
        }
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
    }

    if (download) await recordDocumentDownload(auth.user, doc);
    const stream = await storage.stream(doc.storageKey);
    return new Response(stream, { status: 200, headers: { ...baseHeaders, "Content-Length": String(size) } });
  } catch (err) {
    return errorResponse(err);
  }
}
