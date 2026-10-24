import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, vi } from "vitest";

// ---------------------------------------------------------------------------
// Environment: isolated in-memory database, mock providers, temp storage.
// ---------------------------------------------------------------------------
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "openlibrary-test-"));
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.DATABASE_URL = "pglite://memory";
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.APP_URL = "http://localhost:3000";
process.env.STORAGE_PROVIDER = "local";
process.env.STORAGE_LOCAL_DIR = storageDir;
process.env.TRANSLATION_PROVIDER = "mock";
process.env.AI_PROVIDER = "mock";
process.env.OCR_PROVIDER = "none";
process.env.TRANSLATION_MAX_CHARS = "6000";
process.env.RATE_LIMIT_TRANSLATIONS_PER_HOUR = "100";
process.env.RATE_LIMIT_SUMMARIES_PER_HOUR = "100";
process.env.RATE_LIMIT_LOGIN_PER_15MIN = "5";

// ---------------------------------------------------------------------------
// next/headers mock: an in-memory cookie jar + headers that tests control.
// ---------------------------------------------------------------------------
export const testRequestContext = {
  cookies: new Map<string, string>(),
  headers: new Headers(),
  reset() {
    this.cookies.clear();
    this.headers = new Headers();
  },
};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = testRequestContext.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string, opts?: { maxAge?: number; expires?: Date }) => {
      if ((opts?.maxAge !== undefined && opts.maxAge <= 0) || (opts?.expires && opts.expires.getTime() <= Date.now())) {
        testRequestContext.cookies.delete(name);
      } else {
        testRequestContext.cookies.set(name, value);
      }
    },
    delete: (name: string) => testRequestContext.cookies.delete(name),
    getAll: () => Array.from(testRequestContext.cookies.entries()).map(([name, value]) => ({ name, value })),
  }),
  headers: async () => testRequestContext.headers,
}));

let closeDb: (() => Promise<void>) | null = null;

beforeAll(async () => {
  const { createDbHandle, setDbHandleForTests } = await import("@/lib/db/client");
  const handle = await createDbHandle("pglite://memory");
  await handle.migrate();
  setDbHandleForTests(handle);
  closeDb = handle.close;
});

afterAll(async () => {
  await closeDb?.();
  fs.rmSync(storageDir, { recursive: true, force: true });
});
