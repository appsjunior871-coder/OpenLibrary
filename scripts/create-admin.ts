/**
 * Secure provisioning of the first administrator (or a contributor).
 * Runs on the server only; never exposed through HTTP. The password is read
 * interactively (hidden) or from the ADMIN_PASSWORD env var for CI.
 *
 *   npm run admin:create -- --email admin@example.org --name "Admin" [--role admin|contributor]
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: false });
import readline from "node:readline";
import { Writable } from "node:stream";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function askHidden(question: string): Promise<string> {
  const muted = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(question);
  return new Promise((resolve) => {
    rl.question("", (answer) => {
      process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = arg("name") ?? process.env.ADMIN_NAME ?? "Administrateur";
  const role = (arg("role") ?? "admin") as "admin" | "contributor";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("Usage: npm run admin:create -- --email <email> --name <nom> [--role admin|contributor]");
    process.exit(1);
  }
  if (role !== "admin" && role !== "contributor") {
    console.error("Le rôle doit être 'admin' ou 'contributor'.");
    process.exit(1);
  }
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden("Mot de passe (saisie masquée, 10 caractères min., lettres + chiffres) : ");
    const confirm = await askHidden("Confirmez le mot de passe : ");
    if (password !== confirm) {
      console.error("Les mots de passe ne correspondent pas.");
      process.exit(1);
    }
  }

  const { getDbHandle } = await import("../src/lib/db/client");
  const { provisionStaffUser } = await import("../src/lib/services/auth");
  const handle = await getDbHandle();
  if (handle.kind === "postgres") await handle.migrate();
  const user = await provisionStaffUser({ displayName: name, email, password, role });
  console.log(`✔ Compte ${role} prêt : ${user.email} (id ${user.id}).`);
  await handle.close();
}

main().catch((err) => {
  console.error("Échec :", err instanceof Error ? err.message : err);
  process.exit(1);
});
