import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

// scrypt parameters (OWASP recommendation: N=2^17, r=8, p=1).
const N = 1 << 17;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

/** Hash a password with scrypt. Output format: scrypt$N$r$p$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: 256 * 1024 * 1024,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [algo, nStr, rStr, pStr, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
      maxmem: 256 * 1024 * 1024,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Basic password policy, enforced server-side. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Le mot de passe doit contenir au moins 10 caractères.";
  if (password.length > 128) return "Le mot de passe est trop long (128 caractères maximum).";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  return null;
}
