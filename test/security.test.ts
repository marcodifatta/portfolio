// Test di sicurezza: limite ai tentativi di login, password, upload fuori cartella.
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { hashPassword, verifyPassword } from "../src/auth/password";
import { createUploadStore } from "../src/services/uploads";
import { login, setupApp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupApp>>;
before(async () => {
  ctx = await setupApp();
});
after(async () => {
  await ctx.teardown();
});

test("dopo 5 password sbagliate il 6° tentativo riceve 429", async () => {
  const agent = ctx.agent();
  for (let i = 0; i < 5; i++) assert.equal((await login(agent, "sbagliata")).status, 401);
  const blocked = await login(agent, "sbagliata");
  assert.equal(blocked.status, 429);
  assert.match(blocked.text, /Troppi tentativi/);
});

test("hash scrypt: verifica giusta e sbagliata, nessun $ nel formato", async () => {
  const hash = await hashPassword("una-password-lunga");
  assert.doesNotMatch(hash, /\$/);
  assert.equal(await verifyPassword("una-password-lunga", hash), true);
  assert.equal(await verifyPassword("un-altra", hash), false);
  assert.equal(await verifyPassword("x", "formato-rotto"), false);
});

test("remove() non cancella file fuori dalla cartella degli upload", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "uploads-"));
  const outside = path.join(path.dirname(root), `fuori-${Date.now()}.txt`);
  await writeFile(outside, "da non cancellare");
  const store = createUploadStore(path.join(root, "uploads"));
  await store.remove(`/uploads/../../${path.basename(outside)}`);
  await store.remove("/etc/passwd");
  assert.ok((await readdir(path.dirname(root))).includes(path.basename(outside)));
  await rm(outside);
  await rm(root, { recursive: true, force: true });
});

test("un SVG con script viene convertito in WebP (lo script sparisce)", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "uploads-"));
  const store = createUploadStore(root);
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10"/></svg>',
  );
  const saved = await store.saveImage("logo", "evil", svg);
  assert.match(saved, /\.webp$/);
  await rm(root, { recursive: true, force: true });
});

test("i file di sistema non sono raggiungibili da /uploads", async () => {
  const res = await ctx.agent().get("/uploads/..%2f..%2fpackage.json");
  assert.equal(res.status, 404);
});

test("dietro Cloudflare (CF-Visitor https) il cookie dell'admin viene creato e marcato Secure", async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { createApp } = await import("../src/app");
  const { hashPassword } = await import("../src/auth/password");
  const { createPrisma } = await import("../src/db");
  const { TEST_DATABASE_URL } = await import("./helpers");
  const request = (await import("supertest")).default;
  const prisma = createPrisma(TEST_DATABASE_URL);
  const { app, close } = createApp({
    prisma,
    config: {
      NODE_ENV: "production", PORT: 0, DATABASE_URL: TEST_DATABASE_URL,
      UPLOAD_DIR: await mkdtemp(path.join(tmpdir(), "up-")), SESSION_SECRET: "y".repeat(40), ADMIN_USERNAME: "marco",
      ADMIN_PASSWORD_HASH: await hashPassword("password-di-prova-123"), PUBLIC_URL: "https://mdfdev.xyz",
      DEEPL_API_KEY: undefined, isProd: true,
    },
  });
  const plain = await request(app).get("/admin/login").set("X-Forwarded-Proto", "http");
  assert.equal(plain.headers["set-cookie"], undefined, "senza https nessun cookie Secure");
  const viaCf = await request(app).get("/admin/login").set("X-Forwarded-Proto", "http").set("CF-Visitor", '{"scheme":"https"}');
  assert.match(String(viaCf.headers["set-cookie"]), /mdf\.sid=.*; Secure; SameSite=Lax/);
  await close();
  await prisma.$disconnect();
});
