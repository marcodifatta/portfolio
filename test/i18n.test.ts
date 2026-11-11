// Test delle lingue: scelta automatica, selettore, pagine /en/ e traduzione al salvataggio.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTranslator } from "../src/services/translate";
import { csrf, login, setupApp } from "./helpers";

// DeepL simulato: "traduce" aggiungendo il prefisso EN:
const fakeFetch = (async (_url: unknown, init?: RequestInit) => {
  const texts = (JSON.parse(String(init?.body)) as { text: string[] }).text;
  return Response.json({ translations: texts.map((t) => ({ text: `EN:${t}` })) });
}) as typeof fetch;

let ctx: Awaited<ReturnType<typeof setupApp>>;
before(async () => {
  ctx = await setupApp({ translator: createTranslator("finta:fx", fakeFetch) });
  await ctx.prisma.project.create({
    data: {
      slug: "solo-italiano",
      titleIt: "Solo italiano",
      descriptionIt: "Descrizione solo in italiano.",
      url: "https://a.mdfdev.net",
      status: "PUBLISHED",
      position: 0,
    },
  });
});
after(async () => {
  await ctx.teardown();
});

describe("scelta della lingua", () => {
  test("browser in inglese: / porta a /en/", async () => {
    const res = await ctx.agent().get("/").set("Accept-Language", "en-US,en;q=0.9");
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, "/en/");
    assert.match(res.headers.vary ?? "", /Accept-Language/);
  });

  test("browser in italiano (anche con inglese come seconda lingua): resta su /", async () => {
    const res = await ctx.agent().get("/").set("Accept-Language", "it-IT,it;q=0.9,en;q=0.8");
    assert.equal(res.status, 200);
    assert.match(res.text, /<html lang="it"[ >]/);
  });

  test("browser in altra lingua: resta su / in italiano", async () => {
    const res = await ctx.agent().get("/").set("Accept-Language", "de-DE");
    assert.equal(res.status, 200);
  });

  test("la scelta fatta col selettore vince sulla lingua del browser", async () => {
    const agent = ctx.agent();
    const choose = await agent.get("/lang/it");
    assert.equal(choose.status, 303);
    assert.equal(choose.headers.location, "/");
    assert.match(String(choose.headers["set-cookie"]), /lang=it; .*HttpOnly/);
    const res = await agent.get("/").set("Accept-Language", "en-US");
    assert.equal(res.status, 200);
  });

  test("/en/ è in inglese, con hreflang e canonical", async () => {
    const res = await ctx.agent().get("/en/");
    assert.equal(res.status, 200);
    assert.match(res.text, /<html lang="en"[ >]/);
    assert.match(res.text, /hreflang="it" href="https:\/\/mdfdev.net\/"/);
    assert.match(res.text, /rel="canonical" href="https:\/\/mdfdev.net\/en\/"/);
    assert.equal(res.headers["content-language"], "en");
  });

  test("senza traduzione, /en/ mostra il testo italiano", async () => {
    const res = await ctx.agent().get("/en/");
    assert.match(res.text, /Solo italiano/);
  });

  test("/en senza barra porta a /en/; 404 in inglese sotto /en/", async () => {
    assert.equal((await ctx.agent().get("/en")).headers.location, "/en/");
    const missing = await ctx.agent().get("/en/non-esiste");
    assert.equal(missing.status, 404);
    assert.match(missing.text, /Page not found/);
  });
});

describe("traduzione al salvataggio", () => {
  test("progetto salvato in italiano: l'inglese viene generato e mostrato su /en/", async () => {
    const agent = ctx.agent();
    await login(agent);
    await agent
      .post("/admin/projects")
      .field("_csrf", await csrf(agent))
      .field("titleIt", "Gestionale")
      .field("descriptionIt", "Un gestionale semplice.")
      .field("url", "https://g.mdfdev.net")
      .field("year", "")
      .field("tags", "")
      .field("status", "PUBLISHED")
      .field("titleEn", "")
      .field("descriptionEn", "");
    const p = await ctx.prisma.project.findFirstOrThrow({ where: { titleIt: "Gestionale" } });
    assert.equal(p.titleEn, "EN:Gestionale");
    assert.equal(p.descriptionEn, "EN:Un gestionale semplice.");
    const en = (await ctx.agent().get("/en/")).text;
    assert.match(en, /EN:Gestionale/);
    assert.doesNotMatch((await ctx.agent().get("/").set("Accept-Language", "it")).text, /EN:Gestionale/);
  });

  test("inglese corretto a mano: resta anche se cambia l'italiano", async () => {
    const agent = ctx.agent();
    await login(agent);
    const p = await ctx.prisma.project.findFirstOrThrow({ where: { titleIt: "Gestionale" } });
    await agent
      .post(`/admin/projects/${p.id}`)
      .field("_csrf", await csrf(agent))
      .field("titleIt", "Gestionale nuovo")
      .field("descriptionIt", "Un gestionale semplice e veloce.")
      .field("url", "https://g.mdfdev.net")
      .field("year", "")
      .field("tags", "")
      .field("status", "PUBLISHED")
      .field("titleEn", "Management tool")
      .field("descriptionEn", "My own wording.")
      .field("enManual", "on");
    const updated = await ctx.prisma.project.findUniqueOrThrow({ where: { id: p.id } });
    assert.equal(updated.titleEn, "Management tool");
    assert.equal(updated.descriptionEn, "My own wording.");
    assert.equal(updated.enManual, true);
  });

  test("testi della homepage: l'inglese viene generato", async () => {
    const agent = ctx.agent();
    await login(agent);
    await agent
      .post("/admin/content")
      .field("_csrf", await csrf(agent, "/admin/content"))
      .field("hero.title.it", "Ciao, sono Marco")
      .field("hero.subtitle.it", "")
      .field("about.body.it", "")
      .field("contact.email.it", "");
    const s = await ctx.prisma.setting.findUniqueOrThrow({ where: { key: "hero.title" } });
    assert.equal(s.valueEn, "EN:Ciao, sono Marco");
    assert.match((await ctx.agent().get("/en/")).text, /EN:Ciao, sono Marco/);
  });
});
