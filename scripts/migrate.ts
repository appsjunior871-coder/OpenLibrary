import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: false });
import { createDbHandle } from "../src/lib/db/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "pglite://./.data/pglite";
  const handle = await createDbHandle(url);
  console.log(`[migrate] applying migrations on ${handle.kind} …`);
  await handle.migrate();
  console.log("[migrate] done.");
  await handle.close();
}

main().catch((err) => {
  console.error("[migrate] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
