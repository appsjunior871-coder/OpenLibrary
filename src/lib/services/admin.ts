import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  documentRequests,
  documents,
  translationCache,
  translationReports,
  usageEvents,
  users,
  type UserRole,
  type UserStatus,
} from "../db/schema";
import { Errors } from "../http/errors";
import type { SessionUser } from "../auth/session";
import { destroyAllUserSessions } from "../auth/session";
import { recordAudit } from "./audit";

/**
 * Dashboard indicators. Every number comes from a real query.
 * `period` documents the window of each counter.
 */
export async function getDashboardStats() {
  const db = await getDb();
  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [
    [docCounts],
    [userCounts],
    [reads30],
    [downloads30],
    [translations30],
    topLanguages,
    [requestsPending],
    [reportsOpen],
    [cacheStats],
    [summaries30],
  ] = await Promise.all([
    db
      .select({
        published: sql<number>`count(*) filter (where ${documents.status} = 'published' and ${documents.distributionStatus} = 'approved')::int`,
        pendingReview: sql<number>`count(*) filter (where ${documents.distributionStatus} = 'pending_review' and ${documents.status} <> 'removed')::int`,
        drafts: sql<number>`count(*) filter (where ${documents.status} = 'draft')::int`,
        archived: sql<number>`count(*) filter (where ${documents.status} = 'archived')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(documents),
    db
      .select({
        active: sql<number>`count(*) filter (where ${users.status} = 'active')::int`,
        suspended: sql<number>`count(*) filter (where ${users.status} = 'suspended')::int`,
        staff: sql<number>`count(*) filter (where ${users.role} in ('admin','contributor') and ${users.status} = 'active')::int`,
        newLast30d: sql<number>`count(*) filter (where ${users.createdAt} >= ${since30d})::int`,
      })
      .from(users),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageEvents)
      .where(and(eq(usageEvents.type, "document_open"), gte(usageEvents.createdAt, since30d))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageEvents)
      .where(and(eq(usageEvents.type, "document_download"), gte(usageEvents.createdAt, since30d))),
    db
      .select({
        requested: sql<number>`count(*)::int`,
        cacheHits: sql<number>`count(*) filter (where ${usageEvents.status} = 'cache_hit')::int`,
        providerCalls: sql<number>`count(*) filter (where ${usageEvents.status} = 'provider_success')::int`,
        errors: sql<number>`count(*) filter (where ${usageEvents.status} = 'provider_error')::int`,
        rateLimited: sql<number>`count(*) filter (where ${usageEvents.status} = 'rate_limited')::int`,
        noText: sql<number>`count(*) filter (where ${usageEvents.status} = 'no_text')::int`,
        notConfigured: sql<number>`count(*) filter (where ${usageEvents.status} = 'not_configured')::int`,
        chars: sql<number>`coalesce(sum(${usageEvents.charCount}) filter (where ${usageEvents.status} = 'provider_success'), 0)::int`,
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.type, "translation"), gte(usageEvents.createdAt, since30d))),
    db
      .select({ language: usageEvents.targetLanguage, count: sql<number>`count(*)::int` })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.type, "translation"),
          inArray(usageEvents.status, ["cache_hit", "provider_success"]),
          gte(usageEvents.createdAt, since30d),
        ),
      )
      .groupBy(usageEvents.targetLanguage)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    db.select({ count: sql<number>`count(*)::int` }).from(documentRequests).where(eq(documentRequests.status, "pending")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(translationReports)
      .where(inArray(translationReports.status, ["new", "in_progress"])),
    db
      .select({
        entries: sql<number>`count(*) filter (where ${translationCache.invalidatedAt} is null)::int`,
        chars: sql<number>`coalesce(sum(${translationCache.charCount}) filter (where ${translationCache.invalidatedAt} is null), 0)::int`,
      })
      .from(translationCache),
    db
      .select({
        requested: sql<number>`count(*)::int`,
        cacheHits: sql<number>`count(*) filter (where ${usageEvents.status} = 'cache_hit')::int`,
        errors: sql<number>`count(*) filter (where ${usageEvents.status} = 'provider_error')::int`,
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.type, "summary"), gte(usageEvents.createdAt, since30d))),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    period: { last30DaysSince: since30d.toISOString() },
    documents: docCounts,
    users: userCounts,
    activity30d: {
      reads: reads30.count,
      downloads: downloads30.count,
      translations: translations30,
      summaries: summaries30,
      topTargetLanguages: topLanguages,
    },
    moderation: { pendingRequests: requestsPending.count, openReports: reportsOpen.count },
    cache: cacheStats,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function listUsers(opts: { q?: string; role?: UserRole; status?: UserStatus; page?: number; pageSize?: number } = {}) {
  const db = await getDb();
  const conds = [];
  if (opts.q) {
    const term = `%${opts.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(or(ilike(users.email, term), ilike(users.displayName, term))!);
  }
  if (opts.role) conds.push(eq(users.role, opts.role));
  if (opts.status) conds.push(eq(users.status, opts.status));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 50);
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return { rows, total: count, page, pageSize };
}

export async function setUserStatus(actor: SessionUser, userId: string, status: Exclude<UserStatus, "deleted">, ip?: string | null) {
  if (actor.id === userId) throw Errors.forbidden("Vous ne pouvez pas modifier le statut de votre propre compte.");
  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw Errors.notFound("Utilisateur introuvable.");
  if (target.status === "deleted") throw Errors.conflict("Ce compte a été supprimé.");
  if (target.role === "admin" && status === "suspended") {
    const [{ admins }] = await db
      .select({ admins: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.status, "active")));
    if (admins <= 1) throw Errors.conflict("Impossible de suspendre le dernier administrateur actif.");
  }
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
  if (status === "suspended") await destroyAllUserSessions(userId);
  await recordAudit({ actorId: actor.id, action: `user.${status}`, resourceType: "user", resourceId: userId, ip });
}

/** Role changes are admin-only and audited; the public API never exposes a role field to students. */
export async function setUserRole(actor: SessionUser, userId: string, role: UserRole, ip?: string | null) {
  if (actor.id === userId) throw Errors.forbidden("Vous ne pouvez pas modifier votre propre rôle.");
  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw Errors.notFound("Utilisateur introuvable.");
  if (target.role === "admin" && role !== "admin") {
    const [{ admins }] = await db
      .select({ admins: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.status, "active")));
    if (admins <= 1) throw Errors.conflict("Impossible de rétrograder le dernier administrateur.");
  }
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  await destroyAllUserSessions(userId); // force re-login with the new role
  await recordAudit({ actorId: actor.id, action: "user.role_changed", resourceType: "user", resourceId: userId, metadata: { from: target.role, to: role }, ip });
}
