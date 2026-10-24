import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { summaries, usageEvents } from "../db/schema";
import { getEnv } from "../env";
import { Errors } from "../http/errors";
import type { SessionUser } from "../auth/session";
import { checkRateLimit } from "../rate-limit";
import { getAiProvider } from "../providers/ai";
import { isTranslatableText } from "../pdf/extract";
import { directionFor } from "../i18n/language-names";
import { getLanguage } from "./languages";
import { getPageTexts, openDocumentForUser } from "./documents";
import { hashSegment } from "./translation";
import { recordAudit } from "./audit";

export const MAX_SUMMARY_PAGES = 30;

export type SummaryResult = {
  documentId: string;
  startPage: number;
  endPage: number;
  language: string;
  direction: "ltr" | "rtl";
  summary: string;
  fromCache: boolean;
  truncated: boolean;
  inputChars: number;
  pagesWithoutText: number[];
  provider: string;
};

const inFlight = new Map<string, Promise<SummaryResult>>();

export async function summarizeRange(input: {
  user: SessionUser;
  documentId: string;
  startPage: number;
  endPage: number;
  language: string;
}): Promise<SummaryResult> {
  const key = `${input.documentId}:${input.startPage}-${input.endPage}:${input.language}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = doSummarize(input).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function doSummarize(input: {
  user: SessionUser;
  documentId: string;
  startPage: number;
  endPage: number;
  language: string;
}): Promise<SummaryResult> {
  const env = getEnv();
  const db = await getDb();
  const started = Date.now();
  const doc = await openDocumentForUser(input.documentId, input.user);

  const startPage = Math.max(1, input.startPage);
  const endPage = Math.min(doc.pageCount, input.endPage);
  if (endPage < startPage) throw Errors.badRequest("Intervalle de pages invalide.");
  if (endPage - startPage + 1 > MAX_SUMMARY_PAGES) {
    throw Errors.badRequest(`Un résumé couvre au maximum ${MAX_SUMMARY_PAGES} pages à la fois.`);
  }
  const lang = await getLanguage(input.language);
  if (!lang || !lang.isActive || !lang.supportsSummary) throw Errors.badRequest("Cette langue de résumé n'est pas disponible.");
  const direction = lang.direction ?? directionFor(lang.code);

  const logUsage = (status: (typeof usageEvents.$inferInsert)["status"], extra: Partial<typeof usageEvents.$inferInsert> = {}) =>
    db.insert(usageEvents).values({
      userId: input.user.id,
      documentId: doc.id,
      type: "summary",
      status,
      targetLanguage: lang.code,
      pageNumber: startPage,
      durationMs: Date.now() - started,
      ...extra,
    });

  // Source text
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  const texts = await getPageTexts(doc, pages);
  const pagesWithoutText: number[] = [];
  const parts: string[] = [];
  for (const p of pages) {
    const t = texts.get(p) ?? "";
    if (!isTranslatableText(t)) pagesWithoutText.push(p);
    else parts.push(`[Page ${p}]\n${t}`);
  }
  let text = parts.join("\n\n");
  if (!isTranslatableText(text)) {
    await logUsage("no_text");
    throw Errors.noText(
      "Aucun texte exploitable n'a pu être extrait de ces pages (document numérisé ?). Le résumé est impossible sans reconnaissance de caractères.",
    );
  }
  let truncated = false;
  if (text.length > env.SUMMARY_MAX_INPUT_CHARS) {
    text = text.slice(0, env.SUMMARY_MAX_INPUT_CHARS);
    truncated = true;
  }

  const provider = getAiProvider();
  if (!provider) {
    await logUsage("not_configured");
    throw Errors.notConfigured("Le service de résumé (IA) n'est pas configuré sur cette plateforme. Contactez l'administration.");
  }

  // Cache
  const sourceHash = hashSegment(`${doc.id}:${startPage}-${endPage}:${text}`);
  const [cached] = await db
    .select()
    .from(summaries)
    .where(
      and(
        eq(summaries.sourceHash, sourceHash),
        eq(summaries.language, lang.code),
        eq(summaries.provider, provider.name),
        eq(summaries.engineVersion, provider.engineVersion),
        isNull(summaries.invalidatedAt),
      ),
    )
    .limit(1);
  if (cached) {
    await db.update(summaries).set({ hitCount: sql`${summaries.hitCount} + 1` }).where(eq(summaries.id, cached.id));
    await logUsage("cache_hit", { provider: provider.name });
    return {
      documentId: doc.id,
      startPage,
      endPage,
      language: lang.code,
      direction,
      summary: cached.summary,
      fromCache: true,
      truncated: cached.truncated,
      inputChars: cached.inputChars,
      pagesWithoutText,
      provider: provider.name,
    };
  }

  const rl = checkRateLimit(`summary:${input.user.id}`, env.RATE_LIMIT_SUMMARIES_PER_HOUR, 60 * 60 * 1000);
  if (!rl.allowed) {
    await logUsage("rate_limited");
    throw Errors.rateLimited("Vous avez atteint votre quota horaire de résumés. Réessayez plus tard.", rl.retryAfterSeconds);
  }

  let summaryText: string;
  try {
    const res = await provider.summarize({
      text,
      language: lang.code,
      documentTitle: doc.title,
      pageRange: { start: startPage, end: endPage },
    });
    summaryText = res.summary;
  } catch (err) {
    console.error("[summary] provider error", err instanceof Error ? err.message : err);
    await logUsage("provider_error", { provider: provider.name, charCount: text.length });
    throw Errors.providerError("Le résumé a échoué : le service d'IA n'a pas pu répondre. Réessayez dans quelques instants.");
  }

  await db
    .insert(summaries)
    .values({
      documentId: doc.id,
      startPage,
      endPage,
      language: lang.code,
      sourceHash,
      summary: summaryText,
      provider: provider.name,
      engineVersion: provider.engineVersion,
      inputChars: text.length,
      truncated,
    })
    .onConflictDoNothing();
  await logUsage("provider_success", { provider: provider.name, charCount: text.length });

  return {
    documentId: doc.id,
    startPage,
    endPage,
    language: lang.code,
    direction,
    summary: summaryText,
    fromCache: false,
    truncated,
    inputChars: text.length,
    pagesWithoutText,
    provider: provider.name,
  };
}

export async function invalidateSummaries(actor: SessionUser, documentId: string) {
  const db = await getDb();
  const rows = await db
    .update(summaries)
    .set({ invalidatedAt: new Date() })
    .where(and(eq(summaries.documentId, documentId), isNull(summaries.invalidatedAt)))
    .returning({ id: summaries.id });
  await recordAudit({ actorId: actor.id, action: "summaries.invalidated", resourceType: "document", resourceId: documentId, metadata: { count: rows.length } });
  return rows.length;
}
