import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node.js, memory-hard, salted).
 * Stored format: scrypt$N$r$p$<salt base64url>$<hash base64url>
 * Passwords themselves are never stored or logged.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, opts: ScryptOptions, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P }, KEY_LENGTH);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** A real hash of a random password, checked when an email is unknown so timing doesn't reveal accounts. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(18).toString("base64url"));
  return dummyHash;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64url");
  const cost = Number(n);
  if (!Number.isInteger(cost) || cost < 1024 || cost > 1 << 20 || !expected.length) return false;
  const key = await derive(password, Buffer.from(saltB64, "base64url"), { N: cost, r: Number(r), p: Number(p) }, expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}
