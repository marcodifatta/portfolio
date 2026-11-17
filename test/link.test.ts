// Test della pagina "link in bio" (/link): app pubblicate in ordine di priorità, UTM e contatti.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { orderProjects, sourceFrom, withUtm } from "../src/routes/link";
import { setupApp } from "./helpers";

describe("funzioni della pagina /link", () => {
  test("sourceFrom accetta solo instagram e tiktok", () => {
    assert.equal(sourceFrom("instagram"), "instagram");
    assert.equal(sourceFrom("tiktok"), "tiktok");
    assert.equal(sourceFrom("<script>"), "link");
    assert.equal(sourceFrom(["instagram"]), "link");
    assert.equal(sourceFrom(undefined), "link");
  });

  test("withUtm aggiunge i parametri e conserva quelli esistenti", () => {
    const href = withUtm("https://sconti.mdfdev.net/?q=1", "tiktok");
    const url = new URL(href);
    assert.equal(url.searchParams.get("q"), "1");
    assert.equal(url.searchParams.get("utm_source"), "tiktok");
    assert.equal(url.searchParams.get("utm_medium"), "social");
    assert.equal(url.searchParams.get("utm_campaign"), "link_in_bio");
    assert.equal(withUtm("mailto:a@b.it", "link"), "mailto:a@b.it");
    assert.equal(withUtm("non un link", "link"), "non un link");
  });

  test("orderProjects mette prima le app in evidenza e lascia le altre nell'ordine dell'admin", () => {
    const p = (slug: string) => ({ slug, titleIt: slug, descriptionIt: "", url: "https://x.it", logoPath: null });
    const order = orderProjects([p("altro-b"), p("qrator"), p("altro-a"), p("saldora"), p("shoppylist")]).map((x) => x.slug);
    assert.deepEqual(order, ["shoppylist", "saldora", "qrator", "altro-b", "altro-a"]);
  });
});

let ctx: Awaited<ReturnType<typeof setupApp>>;
before(async () => {
  ctx = await setupApp();
  await ctx.prisma.project.createMany({
    data: [
      { slug: "qrator", titleIt: "QRator", descriptionIt: "Generatore di codici QR.", url: "https://qrator.mdfdev.net/", status: "PUBLISHED", position: 0 },
      { slug: "shoppylist", titleIt: "ShoppyList", descriptionIt: "Lista condivisa.", url: "https://shoppylist.mdfdev.net/", status: "PUBLISHED", position: 1 },
      { slug: "segreto", titleIt: "Segreto", descriptionIt: "Bozza.", url: "https://s.mdfdev.net/", status: "DRAFT", position: 2 },
    ],
  });
  await ctx.prisma.social.create({ data: { kind: "instagram", label: "Instagram", url: "https://www.instagram.com/mdfdev08/", position: 0 } });
  await ctx.prisma.setting.create({ data: { key: "contact.email", valueIt: "mdfdev08@gmail.com" } });
});
after(async () => {
  await ctx.teardown();
});

describe("pagina /link", () => {
  test("mostra le app pubblicate in ordine, con gli UTM della fonte, e nasconde le bozze", async () => {
    const res = await ctx.agent().get("/link?src=instagram");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"] ?? "", /html/);
    assert.match(res.text, /noindex, follow/);
    const shoppy = res.text.indexOf('data-slug="shoppylist"');
    const qrator = res.text.indexOf('data-slug="qrator"');
    assert.ok(shoppy > -1 && qrator > shoppy, "ShoppyList prima di QRator");
    assert.match(res.text, /https:\/\/shoppylist\.mdfdev\.net\/\?utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=link_in_bio/);
    assert.match(res.text, /14 giorni di Famiglia\+ gratis/);
    assert.doesNotMatch(res.text, /Segreto/);
    assert.match(res.text, /href="https:\/\/ig\.me\/m\/mdfdev08"/);
    assert.match(res.text, /mailto:mdfdev08@gmail\.com/);
    assert.match(res.text, /property="og:image" content="https:\/\/mdfdev\.net\/assets\/brand\/share\.jpg"/);
  });

  test("una fonte sconosciuta diventa utm_source=link", async () => {
    const res = await ctx.agent().get("/link?src=%3Cscript%3E");
    assert.equal(res.status, 200);
    assert.match(res.text, /utm_source=link&amp;/);
    assert.doesNotMatch(res.text, /<script>/);
  });

  test("/link/ rimanda a /link", async () => {
    const res = await ctx.agent().get("/link/");
    assert.equal(res.status, 301);
    assert.equal(res.headers["location"], "/link");
  });
});
