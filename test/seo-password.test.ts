// Test di SEO/GEO (robots, sitemap, llms.txt, dati strutturati), link di contatto e accesso, cambio password.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD, csrf, login, setupApp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupApp>>;
before(async () => {
  ctx = await setupApp();
  await ctx.prisma.project.create({
    data: { slug: "qrator", titleIt: "QRator", descriptionIt: "Generatore di codici QR.", url: "https://qrator.mdfdev.xyz/", year: 2024, status: "PUBLISHED", position: 0 },
  });
  await ctx.prisma.project.create({
    data: { slug: "segreto", titleIt: "Segreto", descriptionIt: "Una bozza da non mostrare.", url: "https://s.mdfdev.xyz/", status: "DRAFT", position: 1 },
  });
  await ctx.prisma.social.create({ data: { kind: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/esempio/", position: 0 } });
  await ctx.prisma.setting.createMany({
    data: [
      { key: "hero.title", valueIt: "Web app su misura per piccole attività", valueEn: "Custom web apps for small businesses" },
      { key: "contact.email", valueIt: "contact@mdfdev.xyz" },
    ],
  });
});
after(async () => {
  await ctx.teardown();
});

describe("SEO e GEO", () => {
  test("robots.txt: sito aperto, admin chiuso, crawler AI ammessi, sitemap indicata", async () => {
    const res = await ctx.agent().get("/robots.txt");
    assert.equal(res.status, 200);
    assert.match(res.text, /User-agent: \*\nAllow: \/\nDisallow: \/admin/);
    assert.match(res.text, /User-agent: GPTBot/);
    assert.match(res.text, /User-agent: ClaudeBot/);
    assert.match(res.text, /Sitemap: https:\/\/mdfdev\.xyz\/sitemap\.xml/);
  });

  test("sitemap.xml: le due lingue con hreflang", async () => {
    const res = await ctx.agent().get("/sitemap.xml");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"] ?? "", /xml/);
    assert.match(res.text, /<loc>https:\/\/mdfdev\.xyz\/<\/loc>/);
    assert.match(res.text, /<loc>https:\/\/mdfdev\.xyz\/en\/<\/loc>/);
    assert.match(res.text, /hreflang="x-default"/);
  });

  test("llms.txt: progetti pubblicati sì, bozze no", async () => {
    const res = await ctx.agent().get("/llms.txt");
    assert.equal(res.status, 200);
    assert.match(res.text, /^# Marco Di Fatta/);
    assert.match(res.text, /\[QRator\]\(https:\/\/qrator\.mdfdev\.xyz\/\)/);
    assert.doesNotMatch(res.text, /Segreto/);
  });

  test("dati strutturati schema.org validi, senza bozze, nella lingua della pagina", async () => {
    for (const [path, job] of [["/", "Sviluppatore web"], ["/en/", "Web developer"]] as const) {
      const html = (await ctx.agent().get(path).set("Accept-Language", "it")).text;
      const raw = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
      assert.ok(raw, `JSON-LD presente su ${path}`);
      const data = JSON.parse(raw!) as { "@graph": Array<Record<string, unknown>> };
      const types = data["@graph"].map((g) => g["@type"]);
      assert.deepEqual(types, ["WebSite", "ProfilePage", "Person", "ItemList"]);
      const person = data["@graph"][2]!;
      assert.equal(person.jobTitle, job);
      assert.deepEqual(person.sameAs, ["https://www.linkedin.com/in/esempio/"]);
      assert.equal((data["@graph"][3]!.itemListElement as unknown[]).length, 1);
    }
  });

  test("un testo con </script> nel DB non chiude il blocco JSON-LD", async () => {
    await ctx.prisma.setting.update({ where: { key: "hero.title" }, data: { valueIt: "Prova </script><b>x</b>" } });
    const html = (await ctx.agent().get("/").set("Accept-Language", "it")).text;
    const block = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1] ?? "";
    assert.doesNotMatch(block, /<\/script>/);
    assert.ok(JSON.parse(block));
    await ctx.prisma.setting.update({ where: { key: "hero.title" }, data: { valueIt: "Web app su misura per piccole attività" } });
  });

  test("meta per i link condivisi: og e twitter con URL assoluti", async () => {
    const html = (await ctx.agent().get("/en/")).text;
    assert.match(html, /property="og:url" content="https:\/\/mdfdev\.xyz\/en\/"/);
    assert.match(html, /property="og:image" content="https:\/\/mdfdev\.xyz\/assets\/brand\/share\.jpg"/);
    assert.match(html, /name="twitter:title"/);
    assert.match(html, /property="og:locale" content="en_GB"/);
  });
});

describe("contatti e accesso dal sito", () => {
  test("il pulsante email apre l'indirizzo di contatto", async () => {
    const html = (await ctx.agent().get("/").set("Accept-Language", "it")).text;
    assert.match(html, /href="mailto:contact@mdfdev\.xyz"/);
    // Cloudflare non deve riscrivere l'indirizzo (Email Address Obfuscation)
    assert.ok(html.indexOf("<!--email_off-->") < html.indexOf("href=\"mailto:"));
    assert.ok(html.lastIndexOf("href=\"mailto:") < html.indexOf("<!--/email_off-->"));
  });

  test("nel footer c'è il link all'accesso admin, non seguito dai motori", async () => {
    const html = (await ctx.agent().get("/").set("Accept-Language", "it")).text;
    assert.match(html, /<a class="btn btn--secondary footer__admin" href="\/admin\/login" rel="nofollow">.*Accesso admin<\/a>/);
  });
});

describe("cambio password", () => {
  const change = async (agent: ReturnType<typeof ctx.agent>, current: string, next: string, confirm = next) =>
    agent.post("/admin/password").type("form").send({ _csrf: await csrf(agent, "/admin/password"), current, next, confirm });

  test("senza login la pagina rimanda al login", async () => {
    assert.equal((await ctx.agent().get("/admin/password")).status, 303);
  });

  test("password attuale sbagliata, conferma diversa, troppo corta: errori sotto i campi", async () => {
    const agent = ctx.agent();
    await login(agent);
    let res = await change(agent, "sbagliata-davvero", "una-password-nuova-lunga");
    assert.equal(res.status, 422);
    assert.match(res.text, /La password attuale non è corretta/);
    res = await change(agent, ADMIN_PASSWORD, "una-password-nuova-lunga", "diversa-diversa-diversa");
    assert.match(res.text, /Le due password non coincidono/);
    res = await change(agent, ADMIN_PASSWORD, "corta");
    assert.match(res.text, /Almeno 12 caratteri/);
  });

  test("cambio riuscito: vale la nuova, non più la vecchia, e le altre sessioni si chiudono", async () => {
    const other = ctx.agent();
    await login(other);
    assert.equal((await other.get("/admin/projects")).status, 200);

    const agent = ctx.agent();
    await login(agent);
    const res = await change(agent, ADMIN_PASSWORD, "la-mia-nuova-password-2026");
    assert.equal(res.status, 303);
    assert.equal((await agent.get("/admin/projects")).status, 200, "la sessione di chi cambia resta aperta");
    assert.equal((await other.get("/admin/projects")).status, 303, "l'altra sessione è stata chiusa");

    assert.equal((await login(ctx.agent(), ADMIN_PASSWORD)).status, 401);
    assert.equal((await login(ctx.agent(), "la-mia-nuova-password-2026")).status, 303);
    const row = await ctx.prisma.adminCredential.findUniqueOrThrow({ where: { id: 1 } });
    assert.match(row.passwordHash, /^scrypt:/);
  });
});
