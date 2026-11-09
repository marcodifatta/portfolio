// Reset della password dell'admin da riga di comando, quando non la ricordi più.
// Scrive il nuovo hash nel database (tabella admin_credentials) e chiude tutte le sessioni.
//
//   npm run admin:reset-password                 chiede la nuova password senza mostrarla
//   npm run admin:reset-password -- --random     ne genera una e la stampa una volta
//   npm run admin:reset-password -- --env        cancella quella del database: torna valida quella del .env
//
// Sul server: docker compose exec portfolio npm run admin:reset-password
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";
import { hashPassword } from "../src/auth/password";
import { createPrisma } from "../src/db";

async function askHidden(prompt: string): Promise<string> {
  stdout.write(prompt);
  if (!stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const c of stdin) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString("utf8").trim();
  }
  stdin.setRawMode(true);
  stdin.resume();
  let value = "";
  return new Promise((resolve) => {
    stdin.on("data", (buf) => {
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f") value = value.slice(0, -1);
        else value += ch;
      }
    });
  });
}

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("DATABASE_URL mancante");
  process.exit(1);
}
const prisma = createPrisma(url);
try {
  if (process.argv.includes("--env")) {
    await prisma.adminCredential.deleteMany();
    await prisma.session.deleteMany();
    console.log("Password del database cancellata: vale di nuovo ADMIN_PASSWORD_HASH del .env. Sessioni chiuse.");
  } else {
    const random = process.argv.includes("--random");
    const password = random ? randomBytes(18).toString("base64url") : await askHidden("Nuova password admin: ");
    if (password.length < 12) {
      console.error("La password deve avere almeno 12 caratteri.");
      process.exit(1);
    }
    const passwordHash = await hashPassword(password);
    await prisma.adminCredential.upsert({ where: { id: 1 }, create: { id: 1, passwordHash }, update: { passwordHash } });
    await prisma.session.deleteMany();
    if (random) console.log(`Nuova password: ${password}`);
    console.log("Password aggiornata e sessioni chiuse.");
  }
} finally {
  await prisma.$disconnect();
}
