CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_page_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"text" text NOT NULL,
	"char_count" integer NOT NULL,
	"extractor" text NOT NULL,
	"extractor_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"domain" text,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_response" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"author" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"domain" text NOT NULL,
	"level" text DEFAULT 'tous' NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_language" text NOT NULL,
	"license" text DEFAULT '' NOT NULL,
	"license_notes" text,
	"source_url" text,
	"distribution_status" text DEFAULT 'pending_review' NOT NULL,
	"distribution_checked_by" uuid,
	"distribution_checked_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"allow_download" boolean DEFAULT true NOT NULL,
	"storage_key" text NOT NULL,
	"file_size" integer NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"checksum" text NOT NULL,
	"has_text_layer" boolean,
	"created_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_document_id_pk" PRIMARY KEY("user_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"native_name" text NOT NULL,
	"direction" text DEFAULT 'ltr' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"supports_translation" boolean DEFAULT true NOT NULL,
	"supports_summary" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"last_page" integer DEFAULT 1 NOT NULL,
	"scroll_position" real,
	"last_target_language" text,
	"open_count" integer DEFAULT 1 NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"language" text NOT NULL,
	"source_hash" text NOT NULL,
	"summary" text NOT NULL,
	"provider" text NOT NULL,
	"engine_version" text NOT NULL,
	"input_chars" integer NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invalidated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "translation_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"page_number" integer,
	"segment_index" integer DEFAULT 0 NOT NULL,
	"source_hash" text NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"translated_text" text NOT NULL,
	"provider" text NOT NULL,
	"engine_version" text NOT NULL,
	"char_count" integer NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "translation_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"segment_index" integer,
	"target_language" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"admin_response" text,
	"handled_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"document_id" uuid,
	"type" text NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"target_language" text,
	"page_number" integer,
	"char_count" integer,
	"provider" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_page_texts" ADD CONSTRAINT "document_page_texts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_distribution_checked_by_users_id_fk" FOREIGN KEY ("distribution_checked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_cache" ADD CONSTRAINT "translation_cache_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_reports" ADD CONSTRAINT "translation_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_reports" ADD CONSTRAINT "translation_reports_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_reports" ADD CONSTRAINT "translation_reports_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_page_texts_unique" ON "document_page_texts" USING btree ("document_id","page_number");--> statement-breakpoint
CREATE INDEX "document_requests_user_idx" ON "document_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_requests_status_idx" ON "document_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_domain_idx" ON "documents" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "documents_level_idx" ON "documents" USING btree ("level");--> statement-breakpoint
CREATE INDEX "documents_source_language_idx" ON "documents" USING btree ("source_language");--> statement-breakpoint
CREATE INDEX "documents_author_idx" ON "documents" USING btree ("author");--> statement-breakpoint
CREATE INDEX "documents_created_by_idx" ON "documents" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_history_user_document_unique" ON "reading_history" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE INDEX "reading_history_user_recent_idx" ON "reading_history" USING btree ("user_id","last_accessed_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "summaries_key_unique" ON "summaries" USING btree ("source_hash","language","provider","engine_version");--> statement-breakpoint
CREATE INDEX "summaries_document_idx" ON "summaries" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_cache_key_unique" ON "translation_cache" USING btree ("source_hash","source_language","target_language","provider","engine_version");--> statement-breakpoint
CREATE INDEX "translation_cache_document_idx" ON "translation_cache" USING btree ("document_id","page_number");--> statement-breakpoint
CREATE INDEX "translation_cache_target_idx" ON "translation_cache" USING btree ("target_language");--> statement-breakpoint
CREATE INDEX "translation_reports_status_idx" ON "translation_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "translation_reports_document_idx" ON "translation_reports" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "usage_events_type_created_idx" ON "usage_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_user_idx" ON "usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");