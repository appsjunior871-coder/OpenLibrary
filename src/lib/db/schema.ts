import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Domain value sets (stored as text for portability, validated by zod)
// ---------------------------------------------------------------------------
export const USER_ROLES = ["student", "contributor", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "suspended", "deleted"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DOCUMENT_STATUSES = ["draft", "published", "archived", "removed"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DISTRIBUTION_STATUSES = ["pending_review", "approved", "refused"] as const;
export type DistributionStatus = (typeof DISTRIBUTION_STATUSES)[number];

export const ACADEMIC_LEVELS = ["licence", "master", "doctorat", "tous"] as const;
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export const REQUEST_STATUSES = ["pending", "accepted", "refused"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REPORT_STATUSES = ["new", "in_progress", "resolved", "rejected"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const USAGE_EVENT_TYPES = ["document_open", "document_download", "translation", "summary", "ocr"] as const;
export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

export const USAGE_STATUSES = [
  "ok",
  "cache_hit",
  "provider_success",
  "provider_error",
  "rate_limited",
  "no_text",
  "not_configured",
] as const;
export type UsageStatus = (typeof USAGE_STATUSES)[number];

export type UserPreferences = {
  uiLocale?: "fr" | "en";
  preferredReadingLanguage?: string | null;
  summaryLanguage?: string | null;
  readerLayout?: "side" | "below";
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// Users & sessions
// ---------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<UserRole>().notNull().default("student"),
    status: text("status").$type<UserStatus>().notNull().default("active"),
    preferences: jsonb("preferences").$type<UserPreferences>().notNull().default({}),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email), index("users_role_idx").on(t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 hash of the opaque token stored in the cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------
export const languages = pgTable("languages", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  nativeName: text("native_name").notNull(),
  direction: text("direction").$type<"ltr" | "rtl">().notNull().default("ltr"),
  isActive: boolean("is_active").notNull().default(true),
  supportsTranslation: boolean("supports_translation").notNull().default(true),
  supportsSummary: boolean("supports_summary").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    author: text("author").notNull(),
    description: text("description").notNull().default(""),
    domain: text("domain").notNull(),
    level: text("level").$type<AcademicLevel>().notNull().default("tous"),
    keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
    sourceLanguage: text("source_language").notNull(),
    license: text("license").notNull().default(""),
    licenseNotes: text("license_notes"),
    sourceUrl: text("source_url"),
    distributionStatus: text("distribution_status").$type<DistributionStatus>().notNull().default("pending_review"),
    distributionCheckedBy: uuid("distribution_checked_by").references(() => users.id, { onDelete: "set null" }),
    distributionCheckedAt: timestamp("distribution_checked_at", { withTimezone: true }),
    status: text("status").$type<DocumentStatus>().notNull().default("draft"),
    allowDownload: boolean("allow_download").notNull().default(true),
    storageKey: text("storage_key").notNull(),
    fileSize: integer("file_size").notNull(),
    pageCount: integer("page_count").notNull().default(0),
    checksum: text("checksum").notNull(),
    hasTextLayer: boolean("has_text_layer"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("documents_status_idx").on(t.status),
    index("documents_domain_idx").on(t.domain),
    index("documents_level_idx").on(t.level),
    index("documents_source_language_idx").on(t.sourceLanguage),
    index("documents_author_idx").on(t.author),
    index("documents_created_by_idx").on(t.createdBy),
  ],
);

/** Server-side extraction cache: one row per (document, page). */
export const documentPageTexts = pgTable(
  "document_page_texts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    text: text("text").notNull(),
    charCount: integer("char_count").notNull(),
    extractor: text("extractor").notNull(),
    extractorVersion: text("extractor_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("document_page_texts_unique").on(t.documentId, t.pageNumber)],
);

// ---------------------------------------------------------------------------
// Student activity
// ---------------------------------------------------------------------------
export const documentRequests = pgTable(
  "document_requests",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    author: text("author"),
    domain: text("domain"),
    description: text("description").notNull(),
    status: text("status").$type<RequestStatus>().notNull().default("pending"),
    adminResponse: text("admin_response"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("document_requests_user_idx").on(t.userId), index("document_requests_status_idx").on(t.status)],
);

export const readingHistory = pgTable(
  "reading_history",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    lastPage: integer("last_page").notNull().default(1),
    scrollPosition: real("scroll_position"),
    lastTargetLanguage: text("last_target_language"),
    openCount: integer("open_count").notNull().default(1),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reading_history_user_document_unique").on(t.userId, t.documentId),
    index("reading_history_user_recent_idx").on(t.userId, t.lastAccessedAt),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.documentId] })],
);

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------
export const translationCache = pgTable(
  "translation_cache",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number"),
    segmentIndex: integer("segment_index").notNull().default(0),
    sourceHash: text("source_hash").notNull(),
    sourceLanguage: text("source_language").notNull(),
    targetLanguage: text("target_language").notNull(),
    translatedText: text("translated_text").notNull(),
    provider: text("provider").notNull(),
    engineVersion: text("engine_version").notNull(),
    charCount: integer("char_count").notNull(),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("translation_cache_key_unique").on(
      t.sourceHash,
      t.sourceLanguage,
      t.targetLanguage,
      t.provider,
      t.engineVersion,
    ),
    index("translation_cache_document_idx").on(t.documentId, t.pageNumber),
    index("translation_cache_target_idx").on(t.targetLanguage),
  ],
);

export const translationReports = pgTable(
  "translation_reports",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    segmentIndex: integer("segment_index"),
    targetLanguage: text("target_language").notNull(),
    description: text("description").notNull(),
    status: text("status").$type<ReportStatus>().notNull().default("new"),
    adminResponse: text("admin_response"),
    handledBy: uuid("handled_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("translation_reports_status_idx").on(t.status), index("translation_reports_document_idx").on(t.documentId)],
);

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------
export const summaries = pgTable(
  "summaries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    startPage: integer("start_page").notNull(),
    endPage: integer("end_page").notNull(),
    language: text("language").notNull(),
    sourceHash: text("source_hash").notNull(),
    summary: text("summary").notNull(),
    provider: text("provider").notNull(),
    engineVersion: text("engine_version").notNull(),
    inputChars: integer("input_chars").notNull(),
    truncated: boolean("truncated").notNull().default(false),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("summaries_key_unique").on(t.sourceHash, t.language, t.provider, t.engineVersion),
    index("summaries_document_idx").on(t.documentId),
  ],
);

// ---------------------------------------------------------------------------
// Usage events (statistics) & audit
// ---------------------------------------------------------------------------
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    type: text("type").$type<UsageEventType>().notNull(),
    status: text("status").$type<UsageStatus>().notNull().default("ok"),
    targetLanguage: text("target_language"),
    pageNumber: integer("page_number"),
    charCount: integer("char_count"),
    provider: text("provider"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("usage_events_type_created_idx").on(t.type, t.createdAt),
    index("usage_events_user_idx").on(t.userId, t.createdAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_actor_idx").on(t.actorId)],
);

// ---------------------------------------------------------------------------
// Relations (for relational queries)
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  documents: many(documents),
  favorites: many(favorites),
  readingHistory: many(readingHistory),
  documentRequests: many(documentRequests),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  creator: one(users, { fields: [documents.createdBy], references: [users.id] }),
  pageTexts: many(documentPageTexts),
  favorites: many(favorites),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  document: one(documents, { fields: [favorites.documentId], references: [documents.id] }),
}));

export const readingHistoryRelations = relations(readingHistory, ({ one }) => ({
  user: one(users, { fields: [readingHistory.userId], references: [users.id] }),
  document: one(documents, { fields: [readingHistory.documentId], references: [documents.id] }),
}));

export const documentRequestsRelations = relations(documentRequests, ({ one }) => ({
  user: one(users, { fields: [documentRequests.userId], references: [users.id] }),
}));

export const translationReportsRelations = relations(translationReports, ({ one }) => ({
  user: one(users, { fields: [translationReports.userId], references: [users.id] }),
  document: one(documents, { fields: [translationReports.documentId], references: [documents.id] }),
}));

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Language = typeof languages.$inferSelect;
export type DocumentRequest = typeof documentRequests.$inferSelect;
export type TranslationReport = typeof translationReports.$inferSelect;
export type ReadingHistoryRow = typeof readingHistory.$inferSelect;
export type Summary = typeof summaries.$inferSelect;
export type TranslationCacheRow = typeof translationCache.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
