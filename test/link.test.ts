// Test della pagina "link in bio" (/link) e della sezione "Link in bio" dell'admin.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { eventName, sourceFrom, withUtm } from "../src/routes/link";
import { initBioLinks } from "../src/services/bio-links";
import { createUploadStore } from "../src/services/uploads";
import { csrf, login, pngBuffer, setupApp } from "./helpers";

const ROOT = path.resolve(import.meta.dirname, "..");
let ctx: Awaited<ReturnType<typeof setupApp>>;
const onDisk = (p: string) => path.join(ctx.uploadDir, p.replace(/^\/uploads\//, ""));

before(async () => {
  ctx = await setupApp();
  await mkdir(path.join(ctx.uploadDir, "logos"), { recursive: true });
  await writeFile(path.join(ctx.uploadDir, "logos", "shoppy.png"), await pngBuffer("#c0572f"));
  await ctx.prisma.project.createMany({
    data: [
      { slug: "qrator", titleIt: "QRator", descriptionIt: "Generatore di codici QR.", url: "https://qrator.mdfdev.net/", status: "PUBLISHED", position: 0 },
      { slug: "shoppylist", titleIt: "ShoppyList", descriptionIt: "Lista condivisa.", url: "https://shoppylist.mdfdev.net/", logoPath: "/uploads/logos/shoppy.png", status: "PUBLISHED", position: 1 },
      { slug: "saldora", titleIt: "Saldora", descriptionIt: "Bozza.", url: "https://sconti.mdfdev.net/", status: "DRAFT", position: 2 },
    ],
  });
  await ctx.prisma.social.create({ data: { kind: "instagram", label: "Instagram", url: "https://www.instagram.com/mdfdev08/", position: 0 } });
  await ctx.prisma.setting.create({ data: { key: "contact.email", valueIt: "mdfdev08@gmail.com" } });
});
after(async () => {
  await ctx.teardown();
});

const init = () =>
  initBioLinks(ctx.prisma, createUploadStore(ctx.uploadDir), { uploadDir: ctx.uploadDir, publicDir: path.join(ROOT, "public"), publicUrl: "https://mdfdev.net" });

describe("funzioni della pagina /link", () => {
  test("nome dell'evento Umami dal titolo del pulsante", () => {
    assert.equal(eventName("Saldora"), "click-saldora");
    assert.equal(eventName("ShoppyList"), "click-shoppylist");
    assert.equal(eventName("Città & Più!"), "click-citta-piu");
    assert.equal(eventName("  "), "click-link");
  });

  test("sourceFrom accetta solo instagram e tiktok", () => {
    assert.equal(sourceFrom("instagram"), "instagram");
    assert.equal(sourceFrom("tiktok"), "tiktok");
    assert.equal(sourceFrom("<script>"), "link");
    assert.equal(sourceFrom(["instagram"]), "link");
    assert.equal(sourceFrom(undefined), "link");
  });

  test("withUtm aggiunge i parametri e conserva quelli esistenti", () => {
    const url = new URL(withUtm("https://sconti.mdfdev.net/?q=1", "tiktok"));
    assert.equal(url.searchParams.get("q"), "1");
    assert.equal(url.searchParams.get("utm_source"), "tiktok");
    assert.equal(url.searchParams.get("utm_medium"), "social");
    assert.equal(url.searchParams.get("utm_campaign"), "link_in_bio");
    assert.equal(withUtm("mailto:a@b.it", "link"), "mailto:a@b.it");
    assert.equal(withUtm("non un link", "link"), "non un link");
  });

  test("withUtm rispetta gli utm_ già presenti (link affiliati) e imposta solo utm_source", () => {
    const ig = new URL(withUtm("https://www.instant-gaming.com/it/?igr=gamer-c5b364&utm_medium=gamer-c5b364", "tiktok"));
    assert.equal(ig.searchParams.get("igr"), "gamer-c5b364");
    assert.equal(ig.searchParams.get("utm_medium"), "gamer-c5b364");
    assert.equal(ig.searchParams.get("utm_source"), "tiktok");
    assert.equal(ig.searchParams.get("utm_campaign"), null);
    assert.equal(withUtm("https://t.me/saldora_offerte?utm_source=link", "instagram"), "https://t.me/saldora_offerte?utm_source=instagram");
  });
});

describe("primo avvio: link iniziali", () => {
  test("crea i link delle app pubblicate e il portfolio, con una copia propria dei loghi, una sola volta", async () => {
    assert.deepEqual(await init(), { created: 3 });
    const links = await ctx.prisma.bioLink.findMany({ orderBy: { position: "asc" } });
    assert.deepEqual(links.map((l) => l.title), ["ShoppyList", "QRator", "Portfolio"], "Saldora è in bozza, quindi non c'è");
    assert.match(links[0]!.subtitle, /14 giorni di Famiglia\+ gratis/);
    assert.match(links[0]!.iconPath ?? "", /^\/uploads\/bio\/.+\.webp$/);
    assert.ok(existsSync(onDisk(links[0]!.iconPath!)));
    assert.equal(links[1]!.iconPath, null, "QRator non ha logo");
    assert.equal(links[2]!.url, "https://mdfdev.net/");
    assert.ok(links[2]!.iconPath);

    // eliminati tutti i link dall'admin, al riavvio non tornano
    assert.equal(await init(), null);
  });
});

describe("pagina /link", () => {
  test("mostra i link visibili in ordine, con gli UTM della fonte, e i contatti", async () => {
    const res = await ctx.agent().get("/link?src=instagram");
    assert.equal(res.status, 200);
    assert.match(res.text, /noindex, follow/);
    assert.match(res.text, /property="og:image" content="https:\/\/mdfdev\.net\/assets\/brand\/share\.jpg"/);
    const shoppy = res.text.indexOf("<strong>ShoppyList</strong>");
    const qrator = res.text.indexOf("<strong>QRator</strong>");
    assert.ok(shoppy > -1 && qrator > shoppy, "ShoppyList prima di QRator");
    assert.match(res.text, /https:\/\/shoppylist\.mdfdev\.net\/\?utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=link_in_bio/);
    assert.match(res.text, /<span class="lk-ph" aria-hidden="true">Q<\/span>/, "senza logo compare l'iniziale");
    assert.match(res.text, /href="https:\/\/ig\.me\/m\/mdfdev08"/);
    assert.match(res.text, /mailto:mdfdev08@gmail\.com/);
  });

  test("una fonte sconosciuta diventa utm_source=link", async () => {
    const res = await ctx.agent().get("/link?src=%3Cscript%3E");
    assert.match(res.text, /utm_source=link&amp;/);
    assert.doesNotMatch(res.text, /<script>/);
  });

  test("/link/ rimanda a /link", async () => {
    const res = await ctx.agent().get("/link/");
    assert.equal(res.status, 301);
    assert.equal(res.headers["location"], "/link");
  });
});

describe("admin: Link in bio", () => {
  const ids = async () => (await ctx.prisma.bioLink.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] })).map((l) => l.title);

  test("senza login la sezione rimanda al login", async () => {
    assert.equal((await ctx.agent().get("/admin/bio")).status, 303);
  });

  test("elenco con i link e la voce nel menu", async () => {
    const agent = ctx.agent();
    await login(agent);
    const res = await agent.get("/admin/bio");
    assert.equal(res.status, 200);
    assert.match(res.text, /href="\/admin\/bio" aria-current="page">Link in bio/);
    assert.match(res.text, /ShoppyList/);
  });

  test("aggiunge un link con logo, testo, sottotesto e collegamento; errori sotto i campi", async () => {
    const agent = ctx.agent();
    await login(agent);
    const token = await csrf(agent, "/admin/bio");
    let res = await agent.post("/admin/bio").field("_csrf", token).field("title", "").field("url", "javascript:alert(1)");
    assert.equal(res.status, 422);
    assert.match(res.text, /Scrivi il testo del link/);

    res = await agent.post("/admin/bio").field("_csrf", token).field("title", "Promo").field("subtitle", "Solo questa settimana").field("url", "ftp://x.it");
    assert.match(res.text, /Inserisci un link completo/);

    res = await agent
      .post("/admin/bio")
      .field("_csrf", token)
      .field("title", "Promo")
      .field("subtitle", "Solo questa settimana")
      .field("url", "https://promo.mdfdev.net/")
      .field("visible", "on")
      .attach("icon", await pngBuffer("#225588"), "promo.png");
    assert.equal(res.status, 303);
    const promo = await ctx.prisma.bioLink.findFirstOrThrow({ where: { title: "Promo" } });
    assert.equal(promo.subtitle, "Solo questa settimana");
    assert.ok(promo.iconPath && existsSync(onDisk(promo.iconPath)));
    assert.deepEqual(await ids(), ["ShoppyList", "QRator", "Portfolio", "Promo"], "il nuovo link va in fondo");
    assert.match((await ctx.agent().get("/link")).text, /Solo questa settimana/);
  });

  test("sposta su e giù", async () => {
    const agent = ctx.agent();
    await login(agent);
    const token = await csrf(agent, "/admin/bio");
    const promo = await ctx.prisma.bioLink.findFirstOrThrow({ where: { title: "Promo" } });
    await agent.post(`/admin/bio/${promo.id}/move`).type("form").send({ _csrf: token, direction: "up" });
    await agent.post(`/admin/bio/${promo.id}/move`).type("form").send({ _csrf: token, direction: "up" });
    assert.deepEqual(await ids(), ["ShoppyList", "Promo", "QRator", "Portfolio"]);
    const html = (await ctx.agent().get("/link")).text;
    assert.ok(html.indexOf("<strong>Promo</strong>") < html.indexOf("<strong>QRator</strong>"));
  });

  test("nasconde e rimostra un link senza cancellarlo", async () => {
    const agent = ctx.agent();
    await login(agent);
    const token = await csrf(agent, "/admin/bio");
    const promo = await ctx.prisma.bioLink.findFirstOrThrow({ where: { title: "Promo" } });
    await agent.post(`/admin/bio/${promo.id}/visibility`).type("form").send({ _csrf: token });
    assert.doesNotMatch((await ctx.agent().get("/link")).text, /Promo/);
    assert.match((await agent.get("/admin/bio")).text, /Promo <span class="badge draft">Nascosto<\/span>/);
    await agent.post(`/admin/bio/${promo.id}/visibility`).type("form").send({ _csrf: token });
    assert.match((await ctx.agent().get("/link")).text, /<strong>Promo<\/strong>/);
  });

  test("modifica testi, cambia il logo (il vecchio file si cancella) e poi lo toglie", async () => {
    const agent = ctx.agent();
    await login(agent);
    const promo = await ctx.prisma.bioLink.findFirstOrThrow({ where: { title: "Promo" } });
    const token = await csrf(agent, `/admin/bio/${promo.id}`);
    let res = await agent
      .post(`/admin/bio/${promo.id}`)
      .field("_csrf", token)
      .field("title", "Promo di Natale")
      .field("subtitle", "")
      .field("url", "mdfdev08@gmail.com")
      .field("visible", "on")
      .attach("icon", await pngBuffer("#118844"), "nuovo.png");
    assert.equal(res.status, 303);
    let updated = await ctx.prisma.bioLink.findUniqueOrThrow({ where: { id: promo.id } });
    assert.equal(updated.title, "Promo di Natale");
    assert.equal(updated.url, "mailto:mdfdev08@gmail.com");
    assert.notEqual(updated.iconPath, promo.iconPath);
    assert.equal(existsSync(onDisk(promo.iconPath!)), false, "il logo sostituito è stato cancellato");

    res = await agent.post(`/admin/bio/${promo.id}`).field("_csrf", token).field("title", "Promo di Natale").field("url", "https://promo.mdfdev.net/").field("removeIcon", "on");
    updated = await ctx.prisma.bioLink.findUniqueOrThrow({ where: { id: promo.id } });
    assert.equal(updated.iconPath, null);
    assert.equal(updated.visible, false, "casella Visibile non spuntata: link nascosto");
  });

  test("elimina un link e il suo logo", async () => {
    const agent = ctx.agent();
    await login(agent);
    const token = await csrf(agent, "/admin/bio");
    const shoppy = await ctx.prisma.bioLink.findFirstOrThrow({ where: { title: "ShoppyList" } });
    const res = await agent.post(`/admin/bio/${shoppy.id}/delete`).type("form").send({ _csrf: token });
    assert.equal(res.status, 303);
    assert.equal(await ctx.prisma.bioLink.count({ where: { id: shoppy.id } }), 0);
    assert.equal(existsSync(onDisk(shoppy.iconPath!)), false);
    assert.doesNotMatch((await ctx.agent().get("/link")).text, /<strong>ShoppyList<\/strong>/);
  });

  test("link affiliato: nota sotto il pulsante, evento scelto, nuova scheda e rel sponsored", async () => {
    const agent = ctx.agent();
    await login(agent);
    const token = await csrf(agent, "/admin/bio");
    let res = await agent.post("/admin/bio").field("_csrf", token).field("title", "x").field("url", "https://x.it/").field("event", "Click Strano!");
    assert.equal(res.status, 422);
    assert.match(res.text, /Solo lettere minuscole/);

    res = await agent
      .post("/admin/bio")
      .field("_csrf", token)
      .field("title", "🛒 Giochi scontati su Instant Gaming")
      .field("url", "https://www.instant-gaming.com/it/?igr=gamer-c5b364&utm_medium=gamer-c5b364")
      .field("note", "link affiliato: se compri lì ricevo una piccola commissione, senza costi per te")
      .field("event", "click-instantgaming")
      .field("sponsored", "on")
      .field("newTab", "on")
      .field("visible", "on");
    assert.equal(res.status, 303);
    await agent
      .post("/admin/bio")
      .field("_csrf", token)
      .field("title", "📣 Offerte ogni sera su Telegram")
      .field("url", "https://t.me/saldora_offerte?utm_source=link")
      .field("event", "click-telegram")
      .field("newTab", "on")
      .field("visible", "on");
    assert.match((await agent.get("/admin/bio")).text, /<span class="badge draft">Affiliato<\/span>/);

    const html = (await ctx.agent().get("/link?src=tiktok")).text;
    const ig = html.match(/<a class="lk-item" href="([^"]+)" rel="([^"]+)" target="_blank" data-id="(\d+)" data-umami-event="click-instantgaming" data-umami-event-fonte="tiktok" aria-describedby="lk-note-\3">/);
    assert.ok(ig, "pulsante Instant Gaming");
    assert.equal(ig![1], "https://www.instant-gaming.com/it/?igr=gamer-c5b364&amp;utm_medium=gamer-c5b364&amp;utm_source=tiktok");
    assert.equal(ig![2], "noopener sponsored");
    assert.match(html, /<p class="lk-note" id="lk-note-\d+">link affiliato: se compri lì ricevo una piccola commissione, senza costi per te<\/p>/);
    assert.match(html, /<span class="lk-ph" aria-hidden="true">🛒<\/span>/, "l'iniziale è l'emoji intera");
    assert.match(html, /href="https:\/\/t\.me\/saldora_offerte\?utm_source=tiktok" rel="noopener" target="_blank" data-id="\d+" data-umami-event="click-telegram" data-umami-event-fonte="tiktok">/);

    const noSrc = (await ctx.agent().get("/link")).text;
    assert.match(noSrc, /utm_medium=gamer-c5b364&amp;utm_source=link"/);
  });
});
