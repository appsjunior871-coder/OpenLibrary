import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  documentPageTexts,
  documents,
  favorites,
  languages,
  readingHistory,
  usageEvents,
  users,
  type Document,
  type DocumentStatus,
  type DistributionStatus,
} from "../db/schema";
import { getEnv } from "../env";
import { Errors } from "../http/errors";
import type { SessionUser } from "../auth/session";
import { canEditDocument, isStaff, roleHas } from "../authz/permissions";
import { getStorage, newStorageKey, sha256 } from "../providers/storage";
import { inspectPdf, looksLikePdf } from "../pdf/extract";
import { DISTRIBUTABLE_LICENSES, type CatalogQuery, type DocumentMetadataInput } from "../validation/documents";
import { recordAudit } from "./audit";

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

/** Documents visible in the public catalogue: published AND cleared for distribution. */
export const publicVisibilityWhere = () =>
  and(eq(documents.status, "published"), eq(documents.distributionStatus, "approved"));

export function isPubliclyVisible(doc: Pick<Document, "status" | "distributionStatus">) {
  return doc.status === "published" && doc.distributionStatus === "approved";
}

/** Who may open the PDF itself (reader / download / translation)? */
export function canAccessFile(user: SessionUser | null, doc: Document): boolean {
  if (!user) return false; // Visitors never get the file.
  if (user.status !== "active") return false;
  if (isStaff(user.role) && (roleHas(user.role, "documents:edit-any") || canEditDocument(user.role, user.id, doc.createdBy)))
    return true;
  if (isStaff(user.role) && isPubliclyVisible(doc)) return true;
  return roleHas(user.role, "documents:read") && isPubliclyVisible(doc);
}

export function canDownload(user: SessionUser | null, doc: Document): boolean {
  return canAccessFile(user, doc) && (doc.allowDownload || isStaff(user!.role));
}

/** Metadata safe to expose to anyone (no storage key, no checksum). */
export type PublicDocument = Omit<Document, "storageKey" | "checksum" | "distributionCheckedBy"> & {
  sourceLanguageName: string | null;
};

export function toPublicDocument(doc: Document, sourceLanguageName: string | null = null): PublicDocument {
  const { storageKey: _s, checksum: _c, distributionCheckedBy: _d, ...rest } = doc;
  return { ...rest, sourceLanguageName };
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
export async function searchCatalog(query: CatalogQuery, viewer: SessionUser | null) {
  const db = await getDb();
  const conditions: SQL[] = [];
  // Staff can browse everything from the admin area, but the public catalogue stays public.
  conditions.push(publicVisibilityWhere()!);

  if (query.q) {
    const term = `%${escapeLike(query.q)}%`;
    conditions.push(
      or(
        ilike(documents.title, term),
        ilike(documents.subtitle, term),
        ilike(documents.author, term),
        ilike(documents.description, term),
        sql`array_to_string(${documents.keywords}, ' ') ILIKE ${term}`,
      )!,
    );
  }
  if (query.domain) conditions.push(eq(documents.domain, query.domain));
  if (query.level) conditions.push(eq(documents.level, query.level));
  if (query.author) conditions.push(ilike(documents.author, `%${escapeLike(query.author)}%`));
  if (query.language) conditions.push(eq(documents.sourceLanguage, query.language));
  if (query.keyword) conditions.push(sql`${documents.keywords} @> ARRAY[${query.keyword.toLowerCase()}]::text[]`);

  const where = and(...conditions);
  const orderBy =
    query.sort === "title"
      ? [asc(documents.title)]
      : query.sort === "author"
        ? [asc(documents.author), asc(documents.title)]
        : [desc(documents.publishedAt), desc(documents.createdAt)];

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ doc: documents, languageName: languages.name })
      .from(documents)
      .leftJoin(languages, eq(languages.code, documents.sourceLanguage))
      .where(where)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(documents).where(where),
  ]);

  // Favourite flags for the viewer (students & staff).
  let favoriteIds = new Set<string>();
  if (viewer && rows.length) {
    const favs = await db
      .select({ documentId: favorites.documentId })
      .from(favorites)
      .where(and(eq(favorites.userId, viewer.id), inArray(favorites.documentId, rows.map((r) => r.doc.id))));
    favoriteIds = new Set(favs.map((f) => f.documentId));
  }

  return {
    items: rows.map((r) => ({
      ...toPublicDocument(r.doc, r.languageName),
      isFavorite: favoriteIds.has(r.doc.id),
      canOpen: canAccessFile(viewer, r.doc),
    })),
    total: count,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(count / query.pageSize)),
  };
}

/** Facets used by catalogue filters and the home page — computed from real data. */
export async function getCatalogFacets() {
  const db = await getDb();
  const where = publicVisibilityWhere();
  const [domains, levels, langs, authors] = await Promise.all([
    db
      .select({ value: documents.domain, count: sql<number>`count(*)::int` })
      .from(documents)
      .where(where)
      .groupBy(documents.domain)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ value: documents.level, count: sql<number>`count(*)::int` })
      .from(documents)
      .where(where)
      .groupBy(documents.level),
    db
      .select({ value: documents.sourceLanguage, name: languages.name, count: sql<number>`count(*)::int` })
      .from(documents)
      .leftJoin(languages, eq(languages.code, documents.sourceLanguage))
      .where(where)
      .groupBy(documents.sourceLanguage, languages.name)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ value: documents.author, count: sql<number>`count(*)::int` })
      .from(documents)
      .where(where)
      .groupBy(documents.author)
      .orderBy(desc(sql`count(*)`))
      .limit(30),
  ]);
  return { domains, levels, languages: langs, authors };
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const db = await getDb();
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return row ?? null;
}

/** Document detail for a viewer; hides unpublished documents from non-staff. */
export async function getDocumentForViewer(id: string, viewer: SessionUser | null) {
  const db = await getDb();
  const [row] = await db
    .select({ doc: documents, languageName: languages.name, creatorName: users.displayName })
    .from(documents)
    .leftJoin(languages, eq(languages.code, documents.sourceLanguage))
    .leftJoin(users, eq(users.id, documents.createdBy))
    .where(eq(documents.id, id))
    .limit(1);
  if (!row) return null;
  const doc = row.doc;
  const staffCanSee = viewer && isStaff(viewer.role);
  if (!isPubliclyVisible(doc) && !staffCanSee) return null;

  let isFavorite = false;
  let history: { lastPage: number; lastTargetLanguage: string | null; lastAccessedAt: Date } | null = null;
  if (viewer) {
    const [fav] = await db
      .select({ documentId: favorites.documentId })
      .from(favorites)
      .where(and(eq(favorites.userId, viewer.id), eq(favorites.documentId, id)))
      .limit(1);
    isFavorite = Boolean(fav);
    const [h] = await db
      .select({
        lastPage: readingHistory.lastPage,
        lastTargetLanguage: readingHistory.lastTargetLanguage,
        lastAccessedAt: readingHistory.lastAccessedAt,
      })
      .from(readingHistory)
      .where(and(eq(readingHistory.userId, viewer.id), eq(readingHistory.documentId, id)))
      .limit(1);
    history = h ?? null;
  }
  return {
    ...toPublicDocument(doc, row.languageName),
    creatorName: staffCanSee ? row.creatorName : null,
    isFavorite,
    history,
    canOpen: canAccessFile(viewer, doc),
    canDownload: canDownload(viewer, doc),
  };
}

/** Featured documents for the home page (most recently published). */
export async function listFeaturedDocuments(limit = 6) {
  const db = await getDb();
  const rows = await db
    .select({ doc: documents, languageName: languages.name })
    .from(documents)
    .leftJoin(languages, eq(languages.code, documents.sourceLanguage))
    .where(publicVisibilityWhere())
    .orderBy(desc(documents.publishedAt))
    .limit(limit);
  return rows.map((r) => toPublicDocument(r.doc, r.languageName));
}

// ---------------------------------------------------------------------------
// File access (reader / download)
// ---------------------------------------------------------------------------
export async function openDocumentForUser(id: string, user: SessionUser) {
  const doc = await getDocumentById(id);
  if (!doc) throw Errors.notFound("Document introuvable.");
  if (!canAccessFile(user, doc)) throw Errors.forbidden("Vous n'avez pas accès à ce document.");
  return doc;
}

export async function getDocumentBuffer(doc: Document): Promise<Buffer> {
  return getStorage().get(doc.storageKey);
}

export async function recordDocumentOpen(user: SessionUser, doc: Document) {
  const db = await getDb();
  await db
    .insert(readingHistory)
    .values({ userId: user.id, documentId: doc.id, lastPage: 1, openCount: 1, lastAccessedAt: new Date() })
    .onConflictDoUpdate({
      target: [readingHistory.userId, readingHistory.documentId],
      set: { openCount: sql`${readingHistory.openCount} + 1`, lastAccessedAt: new Date() },
    });
  await db.insert(usageEvents).values({ userId: user.id, documentId: doc.id, type: "document_open", status: "ok" });
}

export async function recordDocumentDownload(user: SessionUser, doc: Document) {
  const db = await getDb();
  await db.insert(usageEvents).values({ userId: user.id, documentId: doc.id, type: "document_download", status: "ok" });
}

// ---------------------------------------------------------------------------
// Page text (server-side extraction cache)
// ---------------------------------------------------------------------------
export async function getPageTexts(doc: Document, pages: number[]): Promise<Map<number, string>> {
  const db = await getDb();
  const wanted = Array.from(new Set(pages.filter((p) => p >= 1 && p <= doc.pageCount)));
  if (wanted.length === 0) return new Map();
  const cached = await db
    .select({ pageNumber: documentPageTexts.pageNumber, text: documentPageTexts.text })
    .from(documentPageTexts)
    .where(and(eq(documentPageTexts.documentId, doc.id), inArray(documentPageTexts.pageNumber, wanted)));
  const result = new Map<number, string>(cached.map((c) => [c.pageNumber, c.text]));
  const missing = wanted.filter((p) => !result.has(p));
  if (missing.length) {
    const { extractPagesText, EXTRACTOR_NAME, EXTRACTOR_VERSION } = await import("../pdf/extract");
    const buffer = await getDocumentBuffer(doc);
    const extracted = await extractPagesText(buffer, missing);
    for (const [page, text] of extracted) {
      result.set(page, text);
      await db
        .insert(documentPageTexts)
        .values({
          documentId: doc.id,
          pageNumber: page,
          text,
          charCount: text.length,
          extractor: EXTRACTOR_NAME,
          extractorVersion: EXTRACTOR_VERSION,
        })
        .onConflictDoNothing();
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Staff management
// ---------------------------------------------------------------------------
export async function createDocument(actor: SessionUser, meta: DocumentMetadataInput, file: Buffer, ip?: string | null) {
  const env = getEnv();
  if (file.length === 0) throw Errors.badRequest("Fichier PDF manquant.");
  if (file.length > env.MAX_UPLOAD_BYTES) throw Errors.payloadTooLarge("Le PDF dépasse la taille maximale autorisée.");
  if (!looksLikePdf(file)) throw Errors.badRequest("Le fichier n'est pas un PDF valide.");

  let inspection;
  try {
    inspection = await inspectPdf(file);
  } catch {
    throw Errors.badRequest("Le PDF est corrompu ou illisible.");
  }

  const db = await getDb();
  const checksum = sha256(file);
  const [dup] = await db.select({ id: documents.id, title: documents.title }).from(documents).where(eq(documents.checksum, checksum)).limit(1);
  if (dup) throw Errors.conflict(`Ce fichier existe déjà dans la bibliothèque (« ${dup.title} »).`);

  const storageKey = newStorageKey("pdf");
  await getStorage().put(storageKey, file);
  const [created] = await db
    .insert(documents)
    .values({
      ...meta,
      ...normaliseMeta(meta),
      storageKey,
      fileSize: file.length,
      pageCount: inspection.pageCount,
      checksum,
      hasTextLayer: inspection.hasTextLayer,
      status: "draft",
      distributionStatus: "pending_review",
      createdBy: actor.id,
    })
    .returning();
  await recordAudit({
    actorId: actor.id,
    action: "document.created",
    resourceType: "document",
    resourceId: created.id,
    metadata: { title: created.title, pages: created.pageCount, size: created.fileSize },
    ip,
  });
  return created;
}

/** Empty optional strings become NULL; everything else passes through. */
function normaliseMeta(meta: Partial<DocumentMetadataInput>) {
  const out: { sourceUrl?: string | null; subtitle?: string | null; licenseNotes?: string | null } = {};
  if ("sourceUrl" in meta) out.sourceUrl = meta.sourceUrl ? meta.sourceUrl : null;
  if ("subtitle" in meta) out.subtitle = meta.subtitle || null;
  if ("licenseNotes" in meta) out.licenseNotes = meta.licenseNotes || null;
  return out;
}

export async function updateDocumentMetadata(actor: SessionUser, id: string, patch: Partial<DocumentMetadataInput>, ip?: string | null) {
  const doc = await getDocumentById(id);
  if (!doc) throw Errors.notFound("Document introuvable.");
  if (!canEditDocument(actor.role, actor.id, doc.createdBy)) throw Errors.forbidden();
  const db = await getDb();
  const licenseChanged = patch.license !== undefined && patch.license !== doc.license;
  const [updated] = await db
    .update(documents)
    .set({
      ...patch,
      ...normaliseMeta(patch),
      // Changing the licence re-opens the distribution review.
      ...(licenseChanged ? { distributionStatus: "pending_review" as DistributionStatus, distributionCheckedAt: null, distributionCheckedBy: null } : {}),
      ...(licenseChanged && doc.status === "published" ? { status: "draft" as DocumentStatus } : {}),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))
    .returning();
  await recordAudit({ actorId: actor.id, action: "document.updated", resourceType: "document", resourceId: id, metadata: { fields: Object.keys(patch) }, ip });
  return updated;
}

export function assertPublishable(doc: Pick<Document, "license" | "distributionStatus" | "pageCount">) {
  if (doc.distributionStatus !== "approved") {
    throw Errors.conflict("La diffusion de ce document n'a pas encore été approuvée par un administrateur.");
  }
  if (!DISTRIBUTABLE_LICENSES.has(doc.license)) {
    throw Errors.conflict("La licence déclarée ne permet pas la diffusion sur la plateforme.");
  }
}

export async function setDistributionStatus(
  actor: SessionUser,
  id: string,
  status: DistributionStatus,
  note: string | undefined,
  ip?: string | null,
) {
  if (!roleHas(actor.role, "documents:approve-distribution")) throw Errors.forbidden();
  const doc = await getDocumentById(id);
  if (!doc) throw Errors.notFound("Document introuvable.");
  if (status === "approved" && !DISTRIBUTABLE_LICENSES.has(doc.license)) {
    throw Errors.conflict("Impossible d'approuver la diffusion : la licence déclarée est insuffisante ou inconnue.");
  }
  const db = await getDb();
  const [updated] = await db
    .update(documents)
    .set({
      distributionStatus: status,
      distributionCheckedBy: actor.id,
      distributionCheckedAt: new Date(),
      licenseNotes: note !== undefined ? note : doc.licenseNotes,
      // A refusal takes a published document offline.
      ...(status !== "approved" && doc.status === "published" ? { status: "draft" as DocumentStatus } : {}),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))
    .returning();
  await recordAudit({ actorId: actor.id, action: "document.distribution_reviewed", resourceType: "document", resourceId: id, metadata: { status }, ip });
  return updated;
}

export async function setDocumentStatus(actor: SessionUser, id: string, status: DocumentStatus, ip?: string | null) {
  const doc = await getDocumentById(id);
  if (!doc) throw Errors.notFound("Document introuvable.");
  if (status === "published" && !roleHas(actor.role, "documents:publish")) throw Errors.forbidden();
  if (status === "removed" && !roleHas(actor.role, "documents:remove")) throw Errors.forbidden();
  if ((status === "draft" || status === "archived") && !canEditDocument(actor.role, actor.id, doc.createdBy)) throw Errors.forbidden();
  if (status === "published") assertPublishable(doc);
  const db = await getDb();
  const [updated] = await db
    .update(documents)
    .set({
      status,
      publishedAt: status === "published" ? (doc.publishedAt ?? new Date()) : doc.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))
    .returning();
  await recordAudit({ actorId: actor.id, action: `document.status.${status}`, resourceType: "document", resourceId: id, ip });
  return updated;
}

export async function listDocumentsForStaff(
  actor: SessionUser,
  opts: { status?: DocumentStatus; q?: string; page?: number; pageSize?: number } = {},
) {
  const db = await getDb();
  const conditions: SQL[] = [];
  if (!roleHas(actor.role, "documents:edit-any")) conditions.push(eq(documents.createdBy, actor.id));
  if (opts.status) conditions.push(eq(documents.status, opts.status));
  if (opts.q) {
    const term = `%${escapeLike(opts.q)}%`;
    conditions.push(or(ilike(documents.title, term), ilike(documents.author, term))!);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ doc: documents, creatorName: users.displayName })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.createdBy))
      .where(where)
      .orderBy(desc(documents.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(documents).where(where),
  ]);
  return { items: rows.map((r) => ({ ...toPublicDocument(r.doc), creatorName: r.creatorName })), total: count, page, pageSize };
}

function escapeLike(s: string) {
  return s.replace(/[%_\\]/g, (m) => `\\${m}`);
}
