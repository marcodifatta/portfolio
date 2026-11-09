// Genera ADMIN_PASSWORD_HASH per il file .env.
//
//   npm run admin:password            chiede la password (non viene mostrata mentre scrivi)
//   npm run admin:password -- --random genera una password casuale e la stampa insieme all'hash
import { randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";
import { hashPassword } from "../src/auth/password";

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

const random = process.argv.includes("--random");
const password = random ? randomBytes(18).toString("base64url") : await askHidden("Nuova password admin: ");
if (password.length < 12) {
  console.error("La password deve avere almeno 12 caratteri.");
  process.exit(1);
}
if (random) console.log(`ADMIN_PASSWORD=${password}`);
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
