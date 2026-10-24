import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, or, gt, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { documents, readingHistory, translationCache, usageEvents, type Document } from "../db/schema";
import { getEnv } from "../env";
import { Errors } from "../http/errors";
import type { SessionUser } from "../auth/session";
import { checkRateLimit } from "../rate-limit";
import { getTranslationProvider, TranslationProviderError } from "../providers/translation";
import { getOcrProvider } from "../providers/ocr";
import { isTranslatableText, segmentText } from "../pdf/extract";
import { directionFor } from "../i18n/language-names";
import { getLanguage } from "./languages";
import { getDocumentBuffer, getPageTexts, openDocumentForUser } from "./documents";
import { recordAudit } from "./audit";

export type TranslatedSegment = {
  index: number;
  source: string;
  translated: string | null; // null when skipped because of the size limit
  fromCache: boolean;
};

export type TranslatePageResult = {
  documentId: string;
  pageNumber: number;
  sourceLanguage: string;
  targetLanguage: string;
  direction: "ltr" | "rtl";
  sameLanguage: boolean;
  segments: TranslatedSegment[];
  provider: string | null;
  cacheHits: number;
  providerSegments: number;
  truncated: boolean;
  ocrUsed: boolean;
};

export function hashSegment(text: string) {
  return createHash("sha256").update(text.normalize("NFC").replace(/\s+/g, " ").trim()).digest("hex");
}

// Prevent concurrent identical requests from hitting the provider twice.
const inFlight = new Map<string, Promise<TranslatePageResult>>();

export async function translatePage(input: {
  user: SessionUser;
  documentId: string;
  pageNumber: number;
  targetLanguage: string;
}): Promise<TranslatePageResult> {
  const key = `${input.user.id}:${input.documentId}:${input.pageNumber}:${input.targetLanguage}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = doTranslatePage(input).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function doTranslatePage(input: {
  user: SessionUser;
  documentId: string;
  pageNumber: number;
  targetLanguage: string;
}): Promise<TranslatePageResult> {
  const env = getEnv();
  const db = await getDb();
  const started = Date.now();
  const doc = await openDocumentForUser(input.documentId, input.user);
  if (input.pageNumber < 1 || input.pageNumber > doc.pageCount) throw Errors.badRequest("Numéro de page invalide.");

  const target = await getLanguage(input.targetLanguage);
  if (!target || !target.isActive || !target.supportsTranslation) {
    throw Errors.badRequest("Cette langue de lecture n'est pas disponible.");
  }
  const direction = target.direction ?? directionFor(target.code);

  const logUsage = async (status: (typeof usageEvents.$inferInsert)["status"], extra: Partial<typeof usageEvents.$inferInsert> = {}) => {
    await db.insert(usageEvents).values({
      userId: input.user.id,
      documentId: doc.id,
      type: "translation",
      status,
      targetLanguage: target.code,
      pageNumber: input.pageNumber,
      durationMs: Date.now() - started,
      ...extra,
    });
  };

  // 1. Page text (extraction cache → pdf.js → optional OCR).
  let ocrUsed = false;
  let text = (await getPageTexts(doc, [input.pageNumber])).get(input.pageNumber) ?? "";
  if (!isTranslatableText(text)) {
    const ocr = getOcrProvider();
    if (ocr) {
      try {
        text = await ocr.recognisePage(await getDocumentBuffer(doc), input.pageNumber, doc.sourceLanguage);
        ocrUsed = true;
        await db.insert(usageEvents).values({ userId: input.user.id, documentId: doc.id, type: "ocr", status: "provider_success", pageNumber: input.pageNumber, provider: ocr.name });
      } catch {
        await db.insert(usageEvents).values({ userId: input.user.id, documentId: doc.id, type: "ocr", status: "provider_error", pageNumber: input.pageNumber, provider: ocr.name });
      }
    }
    if (!isTranslatableText(text)) {
      await logUsage("no_text");
      throw Errors.noText(
        ocr
          ? "Aucun texte exploitable n'a pu être extrait de cette page, même après reconnaissance de caractères."
          : "Cette page ne contient pas de texte extractible (document numérisé). Une reconnaissance de caractères (OCR) serait nécessaire ; elle n'est pas configurée sur cette plateforme.",
      );
    }
  }

  const sourceLanguage = doc.sourceLanguage;
  const segmentsSource = segmentText(text);

  // 2. Same language: nothing to translate, return the original as-is.
  if (sourceLanguage === target.code) {
    await touchHistoryLanguage(input.user.id, doc.id, null);
    return {
      documentId: doc.id,
      pageNumber: input.pageNumber,
      sourceLanguage,
      targetLanguage: target.code,
      direction,
      sameLanguage: true,
      segments: segmentsSource.map((s, i) => ({ index: i, source: s, translated: s, fromCache: true })),
      provider: null,
      cacheHits: segmentsSource.length,
      providerSegments: 0,
      truncated: false,
      ocrUsed,
    };
  }

  // 3. Provider must be configured before we promise anything.
  const provider = getTranslationProvider();
  if (!provider) {
    await logUsage("not_configured");
    throw Errors.notConfigured(
      "Le service de traduction n'est pas configuré sur cette plateforme. Contactez l'administration.",
    );
  }

  // 4. Size limit: translate segments in order until the per-request budget is exhausted.
  let budget = env.TRANSLATION_MAX_CHARS;
  const toProcess: { index: number; source: string; hash: string }[] = [];
  let truncated = false;
  segmentsSource.forEach((source, index) => {
    if (budget - source.length < 0) {
      truncated = true;
      return;
    }
    budget -= source.length;
    toProcess.push({ index, source, hash: hashSegment(source) });
  });

  // 5. Cache lookup (deterministic key: hash + source + target + provider + engine version).
  const hashes = toProcess.map((s) => s.hash);
  const cachedRows = hashes.length
    ? await db
        .select({ id: translationCache.id, sourceHash: translationCache.sourceHash, translatedText: translationCache.translatedText })
        .from(translationCache)
        .where(
          and(
            inArray(translationCache.sourceHash, hashes),
            eq(translationCache.sourceLanguage, sourceLanguage),
            eq(translationCache.targetLanguage, target.code),
            eq(translationCache.provider, provider.name),
            eq(translationCache.engineVersion, provider.engineVersion),
            isNull(translationCache.invalidatedAt),
            or(isNull(translationCache.expiresAt), gt(translationCache.expiresAt, new Date())),
          ),
        )
    : [];
  const cacheByHash = new Map(cachedRows.map((r) => [r.sourceHash, r]));
  const missing = toProcess.filter((s) => !cacheByHash.has(s.hash));

  // 6. Rate limiting applies only when a provider call is needed.
  if (missing.length > 0) {
    const rl = checkRateLimit(`translate:${input.user.id}`, env.RATE_LIMIT_TRANSLATIONS_PER_HOUR, 60 * 60 * 1000);
    if (!rl.allowed) {
      await logUsage("rate_limited");
      throw Errors.rateLimited("Vous avez atteint votre quota horaire de traductions. Réessayez plus tard.", rl.retryAfterSeconds);
    }
  }

  // 7. Provider call for the missing segments only.
  const translatedByHash = new Map<string, string>();
  if (missing.length > 0) {
    // Deduplicate identical segments inside the page.
    const uniqueMissing = Array.from(new Map(missing.map((m) => [m.hash, m])).values());
    try {
      const result = await provider.translate({
        segments: uniqueMissing.map((m) => m.source),
        sourceLanguage,
        targetLanguage: target.code,
      });
      if (result.translations.length !== uniqueMissing.length) throw new TranslationProviderError("Réponse incomplète.");
      uniqueMissing.forEach((m, i) => translatedByHash.set(m.hash, result.translations[i]));
    } catch (err) {
      console.error("[translation] provider error", err instanceof Error ? err.message : err);
      await logUsage("provider_error", { provider: provider.name, charCount: uniqueMissing.reduce((n, m) => n + m.source.length, 0) });
      throw Errors.providerError("La traduction a échoué : le fournisseur n'a pas pu répondre. Réessayez dans quelques instants.");
    }
    // 8. Persist in cache.
    await db
      .insert(translationCache)
      .values(
        uniqueMissing.map((m) => ({
          documentId: doc.id,
          pageNumber: input.pageNumber,
          segmentIndex: m.index,
          sourceHash: m.hash,
          sourceLanguage,
          targetLanguage: target.code,
          translatedText: translatedByHash.get(m.hash)!,
          provider: provider.name,
          engineVersion: provider.engineVersion,
          charCount: m.source.length,
        })),
      )
      .onConflictDoUpdate({
        target: [
          translationCache.sourceHash,
          translationCache.sourceLanguage,
          translationCache.targetLanguage,
          translationCache.provider,
          translationCache.engineVersion,
        ],
        set: { translatedText: sql`excluded.translated_text`, invalidatedAt: null, expiresAt: null },
      });
  }
  if (cachedRows.length) {
    await db
      .update(translationCache)
      .set({ hitCount: sql`${translationCache.hitCount} + 1` })
      .where(inArray(translationCache.id, cachedRows.map((r) => r.id)));
  }

  // 9. Assemble the response in page order.
  const processed = new Map(toProcess.map((s) => [s.index, s]));
  const segments: TranslatedSegment[] = segmentsSource.map((source, index) => {
    const p = processed.get(index);
    if (!p) return { index, source, translated: null, fromCache: false };
    const cached = cacheByHash.get(p.hash);
    if (cached) return { index, source, translated: cached.translatedText, fromCache: true };
    return { index, source, translated: translatedByHash.get(p.hash) ?? null, fromCache: false };
  });

  await logUsage(missing.length === 0 ? "cache_hit" : "provider_success", {
    provider: provider.name,
    charCount: missing.reduce((n, m) => n + m.source.length, 0),
  });
  await touchHistoryLanguage(input.user.id, doc.id, target.code);

  return {
    documentId: doc.id,
    pageNumber: input.pageNumber,
    sourceLanguage,
    targetLanguage: target.code,
    direction,
    sameLanguage: false,
    segments,
    provider: provider.name,
    cacheHits: cachedRows.length,
    providerSegments: missing.length,
    truncated,
    ocrUsed,
  };
}

async function touchHistoryLanguage(userId: string, documentId: string, lang: string | null) {
  const db = await getDb();
  await db
    .insert(readingHistory)
    .values({ userId, documentId, lastTargetLanguage: lang, lastAccessedAt: new Date() })
    .onConflictDoUpdate({
      target: [readingHistory.userId, readingHistory.documentId],
      set: { lastTargetLanguage: lang, lastAccessedAt: new Date() },
    });
}

// ---------------------------------------------------------------------------
// Student: recent translations
// ---------------------------------------------------------------------------
export async function listRecentTranslations(userId: string, limit = 10) {
  const db = await getDb();
  const rows = await db
    .select({
      documentId: usageEvents.documentId,
      title: documents.title,
      targetLanguage: usageEvents.targetLanguage,
      pageNumber: usageEvents.pageNumber,
      status: usageEvents.status,
      createdAt: usageEvents.createdAt,
    })
    .from(usageEvents)
    .innerJoin(documents, eq(documents.id, usageEvents.documentId))
    .where(
      and(
        eq(usageEvents.userId, userId),
        eq(usageEvents.type, "translation"),
        inArray(usageEvents.status, ["cache_hit", "provider_success"]),
      ),
    )
    .orderBy(desc(usageEvents.createdAt))
    .limit(limit);
  return rows;
}

// ---------------------------------------------------------------------------
// Admin: cache management
// ---------------------------------------------------------------------------
export async function listCacheEntries(opts: { documentId?: string; targetLanguage?: string; page?: number; pageSize?: number } = {}) {
  const db = await getDb();
  const conds = [];
  if (opts.documentId) conds.push(eq(translationCache.documentId, opts.documentId));
  if (opts.targetLanguage) conds.push(eq(translationCache.targetLanguage, opts.targetLanguage));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 50);
  const [rows, [{ count }], [agg]] = await Promise.all([
    db
      .select({
        id: translationCache.id,
        documentId: translationCache.documentId,
        documentTitle: documents.title,
        pageNumber: translationCache.pageNumber,
        segmentIndex: translationCache.segmentIndex,
        sourceLanguage: translationCache.sourceLanguage,
        targetLanguage: translationCache.targetLanguage,
        provider: translationCache.provider,
        engineVersion: translationCache.engineVersion,
        charCount: translationCache.charCount,
        hitCount: translationCache.hitCount,
        createdAt: translationCache.createdAt,
        invalidatedAt: translationCache.invalidatedAt,
        preview: sql<string>`left(${translationCache.translatedText}, 140)`,
      })
      .from(translationCache)
      .leftJoin(documents, eq(documents.id, translationCache.documentId))
      .where(where)
      .orderBy(desc(translationCache.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(translationCache).where(where),
    db
      .select({
        active: sql<number>`count(*) filter (where ${translationCache.invalidatedAt} is null)::int`,
        chars: sql<number>`coalesce(sum(${translationCache.charCount}), 0)::int`,
        hits: sql<number>`coalesce(sum(${translationCache.hitCount}), 0)::int`,
      })
      .from(translationCache)
      .where(where),
  ]);
  return { rows, total: count, page, pageSize, stats: agg };
}

export async function invalidateCache(
  actor: SessionUser,
  target: { ids?: string[]; documentId?: string; pageNumber?: number; targetLanguage?: string },
  ip?: string | null,
) {
  const db = await getDb();
  const conds = [isNull(translationCache.invalidatedAt)];
  if (target.ids?.length) conds.push(inArray(translationCache.id, target.ids));
  if (target.documentId) conds.push(eq(translationCache.documentId, target.documentId));
  if (target.pageNumber) conds.push(eq(translationCache.pageNumber, target.pageNumber));
  if (target.targetLanguage) conds.push(eq(translationCache.targetLanguage, target.targetLanguage));
  if (conds.length === 1) throw Errors.badRequest("Précisez au moins un critère d'invalidation.");
  const updated = await db
    .update(translationCache)
    .set({ invalidatedAt: new Date() })
    .where(and(...conds))
    .returning({ id: translationCache.id });
  await recordAudit({ actorId: actor.id, action: "translation_cache.invalidated", resourceType: "translation_cache", metadata: { ...target, count: updated.length }, ip });
  return updated.length;
}
