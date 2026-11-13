// Test della vetrina: applyVetrina con i contenuti veri di prisma/vetrina/vetrina.json.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { createUploadStore } from "../src/services/uploads";
import { applyVetrina, loadVetrina } from "../src/services/vetrina";
import { setupApp } from "./helpers";

const ROOT = path.resolve(import.meta.dirname, "..");
let ctx: Awaited<ReturnType<typeof setupApp>>;
before(async () => {
  ctx = await setupApp();
});
after(async () => {
  await ctx.teardown();
});

const onDisk = (p: string) => path.join(ctx.uploadDir, p.replace(/^\/uploads\//, ""));

test("il file della vetrina è valido: 4 app, link https e descrizioni nelle due lingue", async () => {
  const v = await loadVetrina(path.join(ROOT, "prisma/vetrina/vetrina.json"));
  assert.deepEqual(v.progetti.map((p) => p.slug), ["saldora", "shoppylist", "qrator", "pizzabakery"]);
  for (const p of v.progetti) {
    assert.match(p.url, /^https:\/\//);
    assert.ok(existsSync(path.join(ROOT, p.logo)), `logo di ${p.slug}`);
    assert.ok(p.screenshot && existsSync(path.join(ROOT, p.screenshot)), `screenshot di ${p.slug}`);
    assert.doesNotMatch(JSON.stringify(p), /mdfdev\.xyz/);
  }
});

test("applica la vetrina, la rilancia senza doppioni e lascia in coda i progetti dell'admin", async () => {
  const uploads = createUploadStore(ctx.uploadDir);
  const v = await loadVetrina(path.join(ROOT, "prisma/vetrina/vetrina.json"));
  await ctx.prisma.project.create({
    data: { slug: "aggiunto-admin", titleIt: "Dall'admin", descriptionIt: "Aggiunto a mano dall'admin.", url: "https://x.mdfdev.net", status: "PUBLISHED", position: 0 },
  });

  const first = await applyVetrina(ctx.prisma, uploads, v, ROOT);
  assert.deepEqual(first.created, ["saldora", "shoppylist", "qrator", "pizzabakery"]);
  const before = await ctx.prisma.project.findMany({ orderBy: { position: "asc" } });
  assert.deepEqual(before.map((p) => p.slug), ["saldora", "shoppylist", "qrator", "pizzabakery", "aggiunto-admin"]);
  for (const p of before.slice(0, 4)) {
    assert.equal(p.status, "PUBLISHED");
    assert.ok(p.titleEn && p.descriptionEn && p.tags.length > 0);
    assert.equal((await sharp(onDisk(p.logoPath!)).metadata()).width, 256);
    assert.ok(existsSync(onDisk(p.screenshotPath!)) && existsSync(onDisk(p.screenshotPath!.replace(/\.webp$/, "-sm.webp"))));
  }

  const second = await applyVetrina(ctx.prisma, uploads, v, ROOT);
  assert.deepEqual(second.updated, ["saldora", "shoppylist", "qrator", "pizzabakery"]);
  assert.equal(await ctx.prisma.project.count(), 5);
  const old = before.find((p) => p.slug === "qrator")!;
  assert.equal(existsSync(onDisk(old.logoPath!)), false, "il logo sostituito è stato cancellato");

  const home = (await ctx.agent().get("/").set("Accept-Language", "it")).text;
  assert.ok(home.indexOf("Saldora") < home.indexOf("PizzaBakery"));
  assert.match(home, /href="https:\/\/sconti\.mdfdev\.net\/"/);
  const en = (await ctx.agent().get("/en/")).text;
  assert.match(en, /PC game deals from Steam/);
});
