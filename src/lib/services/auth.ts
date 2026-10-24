import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users, type UserPreferences, type UserRole } from "../db/schema";
import { getEnv } from "../env";
import { Errors } from "../http/errors";
import { checkRateLimit } from "../rate-limit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "../auth/password";
import { createSession, destroyAllUserSessions } from "../auth/session";
import { recordAudit } from "./audit";

const GENERIC_LOGIN_ERROR = "Identifiants incorrects.";

export async function registerUser(input: {
  displayName: string;
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const db = await getDb();
  const weak = validatePasswordStrength(input.password);
  if (weak) throw Errors.validation([{ path: "password", message: weak }]);

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) {
    throw Errors.conflict("Un compte existe déjà avec cette adresse e-mail.");
  }
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      displayName: input.displayName,
      email: input.email,
      passwordHash,
      // Public registration can only ever create students.
      role: "student",
      status: "active",
      termsAcceptedAt: new Date(),
      lastLoginAt: new Date(),
    })
    .returning();
  const session = await createSession(user.id, { ip: input.ip, userAgent: input.userAgent });
  await recordAudit({ actorId: user.id, action: "user.register", resourceType: "user", resourceId: user.id, ip: input.ip });
  return { user, session };
}

export async function loginUser(input: {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const env = getEnv();
  // Brute-force protection keyed on both IP and e-mail.
  const limitKeyIp = `login:ip:${input.ip ?? "unknown"}`;
  const limitKeyEmail = `login:email:${input.email}`;
  const window = 15 * 60 * 1000;
  const byIp = checkRateLimit(limitKeyIp, env.RATE_LIMIT_LOGIN_PER_15MIN * 3, window);
  const byEmail = checkRateLimit(limitKeyEmail, env.RATE_LIMIT_LOGIN_PER_15MIN, window);
  if (!byIp.allowed || !byEmail.allowed) {
    throw Errors.rateLimited(
      "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
      Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds),
    );
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  // Constant-ish time: always verify against a hash, even when the user does not exist.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw Errors.unauthorized(GENERIC_LOGIN_ERROR);
  }
  if (user.status !== "active") {
    throw Errors.forbidden("Ce compte est suspendu. Contactez l'administration.");
  }
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  const session = await createSession(user.id, { ip: input.ip, userAgent: input.userAgent });
  await recordAudit({ actorId: user.id, action: "user.login", resourceType: "user", resourceId: user.id, ip: input.ip });
  return { user, session };
}

// Pre-computed scrypt hash of a random string; used to equalise timing for unknown e-mails.
const DUMMY_HASH =
  "scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export async function updateProfile(
  userId: string,
  patch: { displayName?: string; preferences?: Partial<UserPreferences> },
) {
  const db = await getDb();
  const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!current) throw Errors.notFound();
  const [updated] = await db
    .update(users)
    .set({
      displayName: patch.displayName ?? current.displayName,
      preferences: { ...current.preferences, ...(patch.preferences ?? {}) },
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw Errors.notFound();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw Errors.unauthorized("Mot de passe actuel incorrect.");
  }
  const weak = validatePasswordStrength(newPassword);
  if (weak) throw Errors.validation([{ path: "newPassword", message: weak }]);
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, userId));
  await destroyAllUserSessions(userId);
  await recordAudit({ actorId: userId, action: "user.password_changed", resourceType: "user", resourceId: userId });
}

/**
 * Account deletion: the user row is anonymised and marked deleted so that
 * foreign keys (audit, documents) remain consistent. Personal data is removed.
 */
export async function deleteOwnAccount(userId: string, password: string) {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw Errors.notFound();
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw Errors.unauthorized("Mot de passe incorrect.");
  }
  if (user.role === "admin") {
    throw Errors.forbidden("Un administrateur ne peut pas supprimer son propre compte. Demandez à un autre administrateur.");
  }
  await destroyAllUserSessions(userId);
  await db
    .update(users)
    .set({
      displayName: "Compte supprimé",
      email: `deleted+${userId}@invalid.local`,
      passwordHash: "deleted",
      status: "deleted",
      preferences: {},
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  await recordAudit({ actorId: userId, action: "user.deleted_self", resourceType: "user", resourceId: userId });
}

/** Used by the secure provisioning script only (never by an HTTP route). */
export async function provisionStaffUser(input: {
  displayName: string;
  email: string;
  password: string;
  role: Extract<UserRole, "admin" | "contributor">;
}) {
  const db = await getDb();
  const weak = validatePasswordStrength(input.password);
  if (weak) throw new Error(weak);
  const passwordHash = await hashPassword(input.password);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) {
    const [updated] = await db
      .update(users)
      .set({ role: input.role, passwordHash, status: "active", updatedAt: new Date() })
      .where(eq(users.id, existing[0].id))
      .returning();
    await recordAudit({ actorId: null, action: "user.provisioned", resourceType: "user", resourceId: updated.id, metadata: { role: input.role, via: "cli" } });
    return updated;
  }
  const [created] = await db
    .insert(users)
    .values({
      displayName: input.displayName,
      email: input.email,
      passwordHash,
      role: input.role,
      status: "active",
      termsAcceptedAt: new Date(),
    })
    .returning();
  await recordAudit({ actorId: null, action: "user.provisioned", resourceType: "user", resourceId: created.id, metadata: { role: input.role, via: "cli" } });
  return created;
}
