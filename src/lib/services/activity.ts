import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  documentRequests,
  documents,
  favorites,
  languages,
  readingHistory,
  translationReports,
  users,
  type ReportStatus,
  type RequestStatus,
} from "../db/schema";
import { Errors } from "../http/errors";
import type { SessionUser } from "../auth/session";
import { publicVisibilityWhere, isPubliclyVisible, getDocumentById } from "./documents";
import { recordAudit } from "./audit";

// ---------------------------------------------------------------------------
// Reading history
// ---------------------------------------------------------------------------
export async function listHistory(userId: string, limit = 20) {
  const db = await getDb();
  return db
    .select({
      documentId: readingHistory.documentId,
      title: documents.title,
      author: documents.author,
      domain: documents.domain,
      sourceLanguage: documents.sourceLanguage,
      pageCount: documents.pageCount,
      lastPage: readingHistory.lastPage,
      lastTargetLanguage: readingHistory.lastTargetLanguage,
      openCount: readingHistory.openCount,
      lastAccessedAt: readingHistory.lastAccessedAt,
    })
    .from(readingHistory)
    .innerJoin(documents, eq(documents.id, readingHistory.documentId))
    .where(and(eq(readingHistory.userId, userId), publicVisibilityWhere()))
    .orderBy(desc(readingHistory.lastAccessedAt))
    .limit(limit);
}

export async function updateReadingPosition(
  userId: string,
  documentId: string,
  patch: { lastPage?: number; scrollPosition?: number | null; lastTargetLanguage?: string | null },
) {
  const db = await getDb();
  const doc = await getDocumentById(documentId);
  if (!doc) throw Errors.notFound();
  const lastPage = patch.lastPage !== undefined ? Math.min(Math.max(1, patch.lastPage), Math.max(1, doc.pageCount)) : undefined;
  await db
    .insert(readingHistory)
    .values({
      userId,
      documentId,
      lastPage: lastPage ?? 1,
      scrollPosition: patch.scrollPosition ?? null,
      lastTargetLanguage: patch.lastTargetLanguage ?? null,
      lastAccessedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [readingHistory.userId, readingHistory.documentId],
      set: {
        ...(lastPage !== undefined ? { lastPage } : {}),
        ...(patch.scrollPosition !== undefined ? { scrollPosition: patch.scrollPosition } : {}),
        ...(patch.lastTargetLanguage !== undefined ? { lastTargetLanguage: patch.lastTargetLanguage } : {}),
        lastAccessedAt: new Date(),
      },
    });
}

export async function clearHistoryEntry(userId: string, documentId: string) {
  const db = await getDb();
  await db.delete(readingHistory).where(and(eq(readingHistory.userId, userId), eq(readingHistory.documentId, documentId)));
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------
export async function listFavorites(userId: string) {
  const db = await getDb();
  return db
    .select({
      documentId: favorites.documentId,
      title: documents.title,
      author: documents.author,
      domain: documents.domain,
      level: documents.level,
      sourceLanguage: documents.sourceLanguage,
      sourceLanguageName: languages.name,
      pageCount: documents.pageCount,
      addedAt: favorites.createdAt,
    })
    .from(favorites)
    .innerJoin(documents, eq(documents.id, favorites.documentId))
    .leftJoin(languages, eq(languages.code, documents.sourceLanguage))
    .where(and(eq(favorites.userId, userId), publicVisibilityWhere()))
    .orderBy(desc(favorites.createdAt));
}

export async function addFavorite(userId: string, documentId: string) {
  const db = await getDb();
  const doc = await getDocumentById(documentId);
  if (!doc || !isPubliclyVisible(doc)) throw Errors.notFound("Document introuvable.");
  await db.insert(favorites).values({ userId, documentId }).onConflictDoNothing();
}

export async function removeFavorite(userId: string, documentId: string) {
  const db = await getDb();
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.documentId, documentId)));
}

// ---------------------------------------------------------------------------
// Document requests
// ---------------------------------------------------------------------------
export async function createDocumentRequest(
  userId: string,
  input: { title: string; author?: string | null; domain?: string | null; description: string },
) {
  const db = await getDb();
  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(documentRequests)
    .where(and(eq(documentRequests.userId, userId), eq(documentRequests.status, "pending")));
  if (pending >= 10) throw Errors.conflict("Vous avez déjà 10 demandes en attente. Patientez avant d'en soumettre d'autres.");
  const [created] = await db
    .insert(documentRequests)
    .values({ userId, title: input.title, author: input.author || null, domain: input.domain || null, description: input.description })
    .returning();
  return created;
}

export async function listOwnRequests(userId: string) {
  const db = await getDb();
  return db.select().from(documentRequests).where(eq(documentRequests.userId, userId)).orderBy(desc(documentRequests.createdAt));
}

export async function listAllRequests(opts: { status?: RequestStatus } = {}) {
  const db = await getDb();
  return db
    .select({
      request: documentRequests,
      requesterName: users.displayName,
      requesterEmail: users.email,
    })
    .from(documentRequests)
    .innerJoin(users, eq(users.id, documentRequests.userId))
    .where(opts.status ? eq(documentRequests.status, opts.status) : undefined)
    .orderBy(desc(documentRequests.createdAt));
}

export async function resolveRequest(
  actor: SessionUser,
  id: string,
  status: Exclude<RequestStatus, "pending">,
  response: string,
  ip?: string | null,
) {
  const db = await getDb();
  const [updated] = await db
    .update(documentRequests)
    .set({ status, adminResponse: response, resolvedBy: actor.id, resolvedAt: new Date() })
    .where(eq(documentRequests.id, id))
    .returning();
  if (!updated) throw Errors.notFound("Demande introuvable.");
  await recordAudit({ actorId: actor.id, action: `document_request.${status}`, resourceType: "document_request", resourceId: id, ip });
  return updated;
}

// ---------------------------------------------------------------------------
// Translation reports
// ---------------------------------------------------------------------------
export async function createTranslationReport(
  user: SessionUser,
  input: { documentId: string; pageNumber: number; segmentIndex?: number | null; targetLanguage: string; description: string },
) {
  const db = await getDb();
  const doc = await getDocumentById(input.documentId);
  if (!doc) throw Errors.notFound("Document introuvable.");
  const [created] = await db
    .insert(translationReports)
    .values({
      userId: user.id,
      documentId: input.documentId,
      pageNumber: input.pageNumber,
      segmentIndex: input.segmentIndex ?? null,
      targetLanguage: input.targetLanguage,
      description: input.description,
    })
    .returning();
  return created;
}

export async function listReports(opts: { status?: ReportStatus } = {}) {
  const db = await getDb();
  return db
    .select({
      report: translationReports,
      reporterName: users.displayName,
      documentTitle: documents.title,
    })
    .from(translationReports)
    .innerJoin(users, eq(users.id, translationReports.userId))
    .innerJoin(documents, eq(documents.id, translationReports.documentId))
    .where(opts.status ? eq(translationReports.status, opts.status) : undefined)
    .orderBy(desc(translationReports.createdAt));
}

export async function updateReportStatus(
  actor: SessionUser,
  id: string,
  status: ReportStatus,
  response: string | undefined,
  ip?: string | null,
) {
  const db = await getDb();
  const [updated] = await db
    .update(translationReports)
    .set({
      status,
      adminResponse: response,
      handledBy: actor.id,
      resolvedAt: status === "resolved" || status === "rejected" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(translationReports.id, id))
    .returning();
  if (!updated) throw Errors.notFound("Signalement introuvable.");
  await recordAudit({ actorId: actor.id, action: `translation_report.${status}`, resourceType: "translation_report", resourceId: id, ip });
  return updated;
}
