import { z } from "zod";
import { ACADEMIC_LEVELS, DISTRIBUTION_STATUSES, DOCUMENT_STATUSES } from "../db/schema";

export const DOMAINS = [
  "Informatique",
  "Mathématiques",
  "Physique",
  "Chimie",
  "Biologie",
  "Médecine",
  "Économie",
  "Gestion",
  "Droit",
  "Sciences humaines",
  "Lettres et langues",
  "Ingénierie",
  "Sciences de l'éducation",
  "Autre",
] as const;

export const LICENSES = [
  "CC0",
  "CC BY",
  "CC BY-SA",
  "CC BY-NC",
  "CC BY-NC-SA",
  "CC BY-ND",
  "Domaine public",
  "Autorisation de l'auteur",
  "Licence institutionnelle",
  "Inconnue",
] as const;

/** Licences allowing redistribution on the platform once reviewed by an administrator. */
export const DISTRIBUTABLE_LICENSES: ReadonlySet<string> = new Set([
  "CC0",
  "CC BY",
  "CC BY-SA",
  "CC BY-NC",
  "CC BY-NC-SA",
  "CC BY-ND",
  "Domaine public",
  "Autorisation de l'auteur",
  "Licence institutionnelle",
]);

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  domain: z.string().trim().max(80).optional(),
  level: z.enum(ACADEMIC_LEVELS).optional(),
  author: z.string().trim().max(120).optional(),
  language: z.string().trim().min(2).max(8).optional(),
  keyword: z.string().trim().max(60).optional(),
  sort: z.enum(["recent", "title", "author"]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

const keywordsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")))
  .transform((arr) => Array.from(new Set(arr.map((k) => k.trim().toLowerCase()).filter(Boolean))).slice(0, 20));

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(2).max(250),
  subtitle: z.string().trim().max(250).optional().nullable(),
  author: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).default(""),
  domain: z.string().trim().min(2).max(80),
  level: z.enum(ACADEMIC_LEVELS).default("tous"),
  keywords: keywordsSchema.default([]),
  sourceLanguage: z.string().trim().min(2).max(8),
  license: z.string().trim().min(1).max(80),
  licenseNotes: z.string().trim().max(2000).optional().nullable(),
  sourceUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal("")),
  allowDownload: z.coerce.boolean().default(true),
});
export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;

export const documentUpdateSchema = documentMetadataSchema.partial();

export const documentStatusSchema = z.object({
  status: z.enum(DOCUMENT_STATUSES),
});

export const distributionSchema = z.object({
  distributionStatus: z.enum(DISTRIBUTION_STATUSES),
  note: z.string().trim().max(2000).optional(),
});
