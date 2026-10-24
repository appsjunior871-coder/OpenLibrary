import path from "node:path";
import fs from "node:fs";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { getEnv } from "../env";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

type DbHandle = {
  db: Db;
  kind: "pglite" | "postgres";
  migrate: () => Promise<void>;
  close: () => Promise<void>;
};

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

const globalForDb = globalThis as unknown as { __openlibraryDb?: Promise<DbHandle> };

/**
 * Creates a database handle from a connection string.
 *  - pglite://memory          → in-memory PGlite (tests)
 *  - pglite://./.data/pglite  → file-backed PGlite (local development)
 *  - postgres://...           → node-postgres pool (production)
 */
export async function createDbHandle(databaseUrl: string): Promise<DbHandle> {
  if (databaseUrl.startsWith("pglite://")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const target = databaseUrl.slice("pglite://".length);
    let client: InstanceType<typeof PGlite>;
    if (target === "memory" || target === "") {
      client = new PGlite();
    } else {
      const dir = path.resolve(process.cwd(), target);
      fs.mkdirSync(dir, { recursive: true });
      client = new PGlite(dir);
    }
    try {
      await client.waitReady;
    } catch (err) {
      // A killed process can leave the embedded database without a valid WAL checkpoint.
      // PGlite then aborts with an opaque WASM "Aborted()" error; make it actionable.
      if (target !== "memory" && target !== "") {
        throw new Error(
          `Impossible d'ouvrir la base PGlite locale (${target}). Elle est probablement corrompue après un arrêt brutal. ` +
            `Supprimez ce dossier puis relancez \`npm run admin:create\` et \`npm run db:seed\`. Cause : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      throw err;
    }
    const db = drizzle(client, { schema }) as unknown as Db;
    return {
      db,
      kind: "pglite",
      migrate: () => migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: () => client.close(),
    };
  }

  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: databaseUrl, max: 10 });
  const db = drizzle(pool, { schema }) as unknown as Db;
  return {
    db,
    kind: "postgres",
    migrate: () => migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => pool.end(),
  };
}

/**
 * Application-wide database handle. Lazily created, cached on globalThis so that
 * Next.js hot reloads do not open several PGlite instances on the same directory.
 * Migrations are applied automatically for PGlite (zero-setup development);
 * for PostgreSQL run `npm run db:migrate` explicitly.
 */
export function getDbHandle(): Promise<DbHandle> {
  if (!globalForDb.__openlibraryDb) {
    globalForDb.__openlibraryDb = (async () => {
      const env = getEnv();
      const handle = await createDbHandle(env.DATABASE_URL);
      if (handle.kind === "pglite") {
        await handle.migrate();
      }
      return handle;
    })();
  }
  return globalForDb.__openlibraryDb;
}

export async function getDb(): Promise<Db> {
  return (await getDbHandle()).db;
}

/** Test helper: replace the global handle (e.g. with an in-memory instance). */
export function setDbHandleForTests(handle: DbHandle) {
  globalForDb.__openlibraryDb = Promise.resolve(handle);
}

export { schema };
