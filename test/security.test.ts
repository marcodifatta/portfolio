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
