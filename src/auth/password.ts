// Hash delle password con scrypt (incluso in Node, nessuna dipendenza nativa).
// Formato: scrypt:<N>:<salt hex>:<hash hex>. Niente "$", così il valore si può
// mettere in un .env di Docker Compose senza che venga interpretato come variabile.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 15;
const KEY_LEN = 64;

function scrypt(password: string, salt: Buffer, n: number): Promise<Buffer> {
  const options: ScryptOptions = { N: n, r: 8, p: 1, maxmem: 128 * n * 8 * 2 };
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize("NFKC"), salt, KEY_LEN, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N);
  return `scrypt:${N}:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, nStr, saltHex, keyHex] = stored.split(":");
  if (algo !== "scrypt" || !nStr || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), Number(nStr));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
