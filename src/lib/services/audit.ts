import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { auditLogs, users } from "../db/schema";

export type AuditInput = {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

/** Persist an audit entry. Never include secrets or full document text in metadata. */
export async function recordAudit(input: AuditInput) {
  const db = await getDb();
  await db.insert(auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata ?? {},
    ip: input.ip ?? null,
  });
}

export async function listAuditLogs(opts: { page?: number; pageSize?: number; action?: string } = {}) {
  const db = await getDb();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const where = opts.action ? eq(auditLogs.action, opts.action) : undefined;
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        metadata: auditLogs.metadata,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
        actorId: auditLogs.actorId,
        actorName: users.displayName,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
  ]);
  return { rows, total: count, page, pageSize };
}
