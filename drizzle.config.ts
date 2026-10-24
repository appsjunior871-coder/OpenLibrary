import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  // drizzle-kit only needs credentials for push/studio; `generate` works offline.
  dbCredentials: {
    url: process.env.DATABASE_URL?.startsWith("postgres")
      ? process.env.DATABASE_URL
      : "postgres://localhost:5432/openlibrary",
  },
  strict: true,
  verbose: true,
});
