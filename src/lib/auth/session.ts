import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "../db/client";
import { sessions, users, type User } from "../db/schema";
import { getEnv } from "../env";

export const SESSION_COOKIE = "ol_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2;

export type SessionUser = Pick<
  User,
  "id" | "displayName" | "email" | "role" | "status" | "preferences" | "createdAt" | "lastLoginAt"
>;

export type AuthContext = {
  user: SessionUser;
  sessionId: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expires: Date) {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production" || env.APP_URL.startsWith("https://"),
    path: "/",
    expires,
  };
}

/** Creates a persisted session and returns the raw token to put in the cookie. */
export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}

/** Deletes the session row behind the given raw token (logout). */
export async function destroySessionByToken(token: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Deletes every session of a user (suspension, password change, account deletion). */
export async function destroyAllUserSessions(userId: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions() {
  const db = await getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/** Resolve a raw token into an authenticated context (or null). Pure DB logic, testable. */
export async function resolveSessionToken(token: string | undefined | null): Promise<AuthContext | null> {
  if (!token || token.length < 20) return null;
  const db = await getDb();
  const id = hashToken(token);
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        status: users.status,
        preferences: users.preferences,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.user.status !== "active") {
    // Suspended / deleted accounts lose their sessions immediately.
    await db.delete(sessions).where(eq(sessions.userId, row.user.id));
    return null;
  }
  // Sliding expiration.
  if (row.expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, id));
  }
  return { user: row.user, sessionId: id };
}

/**
 * Current request's authentication context. Memoised per request with React cache.
 */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return resolveSessionToken(token);
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getAuth())?.user ?? null;
}

export async function getRequestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded ? forwarded.split(",")[0].trim() : (h.get("x-real-ip") ?? null),
    userAgent: h.get("user-agent"),
  };
}
