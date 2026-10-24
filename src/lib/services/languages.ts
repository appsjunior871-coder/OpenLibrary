import { asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { languages, type Language } from "../db/schema";
import { Errors } from "../http/errors";
import { recordAudit } from "./audit";

export async function listLanguages(opts: { activeOnly?: boolean } = {}): Promise<Language[]> {
  const db = await getDb();
  const rows = await db.select().from(languages).orderBy(asc(languages.sortOrder), asc(languages.code));
  return opts.activeOnly ? rows.filter((l) => l.isActive) : rows;
}

/** Languages a student may pick in the reader. */
export async function listActiveTranslationLanguages(): Promise<Language[]> {
  return (await listLanguages({ activeOnly: true })).filter((l) => l.supportsTranslation);
}

export async function getLanguage(code: string): Promise<Language | null> {
  const db = await getDb();
  const [row] = await db.select().from(languages).where(eq(languages.code, code)).limit(1);
  return row ?? null;
}

export async function updateLanguage(
  actorId: string,
  code: string,
  patch: Partial<Pick<Language, "isActive" | "supportsTranslation" | "supportsSummary" | "sortOrder" | "name" | "nativeName">>,
) {
  const db = await getDb();
  const existing = await getLanguage(code);
  if (!existing) throw Errors.notFound("Langue inconnue.");
  const [updated] = await db
    .update(languages)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(languages.code, code))
    .returning();
  await recordAudit({ actorId, action: "language.updated", resourceType: "language", resourceId: code, metadata: patch });
  return updated;
}

export async function createLanguage(
  actorId: string,
  input: Pick<Language, "code" | "name" | "nativeName" | "direction"> & Partial<Pick<Language, "isActive" | "sortOrder">>,
) {
  const db = await getDb();
  if (await getLanguage(input.code)) throw Errors.conflict("Cette langue existe déjà.");
  const [created] = await db
    .insert(languages)
    .values({
      code: input.code,
      name: input.name,
      nativeName: input.nativeName,
      direction: input.direction,
      isActive: input.isActive ?? false,
      sortOrder: input.sortOrder ?? 100,
    })
    .returning();
  await recordAudit({ actorId, action: "language.created", resourceType: "language", resourceId: input.code });
  return created;
}
