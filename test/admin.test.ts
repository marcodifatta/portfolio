// Test dell'area admin: accesso, CSRF, progetti, upload, riordino, contenuti e social.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import sharp from "sharp";
import { csrf, csrfFrom, login, pngBuffer, setupApp } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupApp>>;
before(async () => {
  ctx = await setupApp();
});
after(async () => {
  await ctx.teardown();
});

const fileOnDisk = (publicPath: string) => path.join(ctx.uploadDir, publicPath.replace(/^\/uploads\//, ""));

async function createProject(agent: ReturnType<typeof ctx.agent>, fields: Record<string, string>, logo?: Buffer) {
  const req = agent
    .post("/admin/projects")
    .field("_csrf", await csrf(agent))
    .field("titleIt", fields.titleIt ?? "Progetto di prova")
    .field("descriptionIt", fields.descriptionIt ?? "Una descrizione abbastanza lunga.")
    .field("url", fields.url ?? "https://esempio.mdfdev.xyz")
    .field("year", fields.year ?? "2026")
    .field("tags", fields.tags ?? "Node.js, PostgreSQL")
    .field("status", fields.status ?? "PUBLISHED")
    .field("titleEn", "")
    .field("descriptionEn", "");
  if (logo) req.attach("logo", logo, "logo.png");
  return req;
}

describe("accesso", () => {
  test("senza login le pagine admin rimandano al login", async () => {
    const res = await ctx.agent().get("/admin/projects");
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/admin/login?next=%2Fadmin%2Fprojects");
  });

  test("password sbagliata: 401 e nessuna sessione admin", async () => {
    const agent = ctx.agent();
    const res = await login(agent, "sbagliata");
    assert.equal(res.status, 401);
    assert.match(res.text, /Utente o password non corretti/);
    assert.equal((await agent.get("/admin/projects")).status, 303);
  });

  test("login corretto porta alla pagina richiesta", async () => {
    const agent = ctx.agent();
    const res = await login(agent);
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/admin/projects");
    assert.equal((await agent.get("/admin/projects")).status, 200);
  });

  test("il redirect dopo il login non porta fuori dal sito", async () => {
    const agent = ctx.agent();
    const page = await agent.get("/admin/login");
    const res = await agent
      .post("/admin/login")
      .type("form")
      .send({ _csrf: csrfFrom(page.text), username: "marco", password: "password-di-prova-123", next: "//evil.example" });
    assert.equal(res.headers.location, "/admin");
  });

  test("POST senza token CSRF viene rifiutato", async () => {
    const agent = ctx.agent();
    await login(agent);
    const res = await agent.post("/admin/projects/1/delete").type("form").send({});
    assert.equal(res.status, 403);
  });

  test("logout chiude la sessione", async () => {
    const agent = ctx.agent();
    await login(agent);
    await agent.post("/admin/logout").type("form").send({ _csrf: await csrf(agent) });
    assert.equal((await agent.get("/admin/projects")).status, 303);
  });

  test("le pagine admin non vanno in cache e non vengono indicizzate", async () => {
    const res = await ctx.agent().get("/admin/login");
    assert.equal(res.headers["cache-control"], "no-store");
    assert.match(res.headers["x-robots-tag"] ?? "", /noindex/);
  });
});

describe("progetti", () => {
  test("creato con logo: compare in homepage, logo convertito in WebP 256px", async () => {
    const agent = ctx.agent();
    await login(agent);
    const res = await createProject(agent, { titleIt: "QRator Nuovo" }, await pngBuffer());
    assert.equal(res.status, 303);
    const project = await ctx.prisma.project.findFirstOrThrow({ where: { titleIt: "QRator Nuovo" } });
    assert.equal(project.slug, "qrator-nuovo");
    assert.deepEqual(project.tags, ["Node.js", "PostgreSQL"]);
    assert.ok(project.logoPath?.endsWith(".webp"));
    const meta = await sharp(fileOnDisk(project.logoPath!)).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 256);
    const home = await ctx.agent().get("/");
    assert.match(home.text, /QRator Nuovo/);
  });

  test("bozza: non compare in homepage", async () => {
    const agent = ctx.agent();
    await login(agent);
    await createProject(agent, { titleIt: "Progetto segreto", status: "DRAFT" });
    const home = await ctx.agent().get("/");
    assert.doesNotMatch(home.text, /Progetto segreto/);
  });

  test("link non valido: errore sotto il campo, niente salvato", async () => {
    const agent = ctx.agent();
    await login(agent);
    const res = await createProject(agent, { titleIt: "Link rotto", url: "javascript:alert(1)" });
    assert.equal(res.status, 422);
    assert.match(res.text, /Inserisci un link completo/);
    assert.equal(await ctx.prisma.project.count({ where: { titleIt: "Link rotto" } }), 0);
  });

  test("un file che non è un'immagine viene rifiutato", async () => {
    const agent = ctx.agent();
    await login(agent);
    const res = await createProject(agent, { titleIt: "Logo finto" }, Buffer.from("<html>non sono un png</html>"));
    assert.equal(res.status, 422);
    assert.match(res.text, /non è un&#39;immagine valida/);
  });

  test("riordino: spostare in su cambia l'ordine della homepage", async () => {
    const agent = ctx.agent();
    await login(agent);
    await createProject(agent, { titleIt: "Ordine Alfa" });
    await createProject(agent, { titleIt: "Ordine Beta" });
    const beta = await ctx.prisma.project.findFirstOrThrow({ where: { titleIt: "Ordine Beta" } });
    await agent.post(`/admin/projects/${beta.id}/move`).type("form").send({ _csrf: await csrf(agent), direction: "up" });
    const home = (await ctx.agent().get("/")).text;
    assert.ok(home.indexOf("Ordine Beta") < home.indexOf("Ordine Alfa"));
  });

  test("modifica con nuovo logo cancella il file vecchio", async () => {
    const agent = ctx.agent();
    await login(agent);
    await createProject(agent, { titleIt: "Cambio logo" }, await pngBuffer("#000000"));
    const before = await ctx.prisma.project.findFirstOrThrow({ where: { titleIt: "Cambio logo" } });
    const res = await agent
      .post(`/admin/projects/${before.id}`)
      .field("_csrf", await csrf(agent))
      .field("titleIt", "Cambio logo")
      .field("descriptionIt", "Descrizione aggiornata del progetto.")
      .field("url", "https://esempio.mdfdev.xyz")
      .field("year", "")
      .field("tags", "")
      .field("status", "PUBLISHED")
      .field("titleEn", "")
      .field("descriptionEn", "")
      .attach("logo", await pngBuffer("#ffffff"), "nuovo.png");
    assert.equal(res.status, 303);
    const updated = await ctx.prisma.project.findUniqueOrThrow({ where: { id: before.id } });
    assert.notEqual(updated.logoPath, before.logoPath);
    assert.equal(existsSync(fileOnDisk(before.logoPath!)), false);
    assert.equal(existsSync(fileOnDisk(updated.logoPath!)), true);
    assert.equal(updated.year, null);
  });

  test("eliminazione: sparisce dal sito e il logo viene cancellato", async () => {
    const agent = ctx.agent();
    await login(agent);
    await createProject(agent, { titleIt: "Da eliminare" }, await pngBuffer());
    const p = await ctx.prisma.project.findFirstOrThrow({ where: { titleIt: "Da eliminare" } });
    const res = await agent.post(`/admin/projects/${p.id}/delete`).type("form").send({ _csrf: await csrf(agent) });
    assert.equal(res.status, 303);
    assert.equal(await ctx.prisma.project.count({ where: { id: p.id } }), 0);
    assert.equal(existsSync(fileOnDisk(p.logoPath!)), false);
    assert.doesNotMatch((await ctx.agent().get("/")).text, /Da eliminare/);
  });

  test("pubblica e metti in bozza dalla lista", async () => {
    const agent = ctx.agent();
    await login(agent);
    await createProject(agent, { titleIt: "Interruttore", status: "DRAFT" });
    const p = await ctx.prisma.project.findFirstOrThrow({ where: { titleIt: "Interruttore" } });
    await agent.post(`/admin/projects/${p.id}/status`).type("form").send({ _csrf: await csrf(agent) });
    assert.match((await ctx.agent().get("/")).text, /Interruttore/);
  });
});

describe("contenuti, CV, social e competenze", () => {
  test("i testi salvati compaiono in homepage", async () => {
    const agent = ctx.agent();
    await login(agent);
    const res = await agent
      .post("/admin/content")
      .field("_csrf", await csrf(agent, "/admin/content"))
      .field("hero.title.it", "Ciao, sono Marco")
      .field("hero.subtitle.it", "Costruisco web app.")
      .field("about.body.it", "")
      .field("contact.email.it", "mdfdev08@gmail.com");
    assert.equal(res.status, 303);
    const home = (await ctx.agent().get("/")).text;
    assert.match(home, /Ciao, sono Marco/);
    assert.match(home, /Costruisco web app\./);
  });

  test("email di contatto non valida: errore", async () => {
    const agent = ctx.agent();
    await login(agent);
    const res = await agent
      .post("/admin/content")
      .field("_csrf", await csrf(agent, "/admin/content"))
      .field("hero.title.it", "Ciao")
      .field("contact.email.it", "non-una-email");
    assert.equal(res.status, 422);
    assert.match(res.text, /Email non valida/);
  });

  test("CV: accetta solo PDF", async () => {
    const agent = ctx.agent();
    await login(agent);
    const token = await csrf(agent, "/admin/content");
    await agent.post("/admin/content/cv").field("_csrf", token).attach("cv", Buffer.from("non un pdf"), "cv.pdf");
    assert.equal(await ctx.prisma.setting.count({ where: { key: "cv.path" } }), 0);
    await agent.post("/admin/content/cv").field("_csrf", token).attach("cv", Buffer.from("%PDF-1.7\n%%EOF"), "cv.pdf");
    const cv = await ctx.prisma.setting.findUniqueOrThrow({ where: { key: "cv.path" } });
    assert.match(cv.valueIt, /^\/uploads\/cv\/marco-di-fatta-cv-[0-9a-f]{8}\.pdf$/);
    assert.equal((await ctx.agent().get(cv.valueIt)).status, 200);
  });

  test("social: email senza mailto viene normalizzata", async () => {
    const agent = ctx.agent();
    await login(agent);
    await agent
      .post("/admin/socials")
      .type("form")
      .send({ _csrf: await csrf(agent, "/admin/socials"), kind: "email", label: "", url: "mdfdev08@gmail.com" });
    const s = await ctx.prisma.social.findFirstOrThrow({ where: { kind: "email" } });
    assert.equal(s.url, "mailto:mdfdev08@gmail.com");
    assert.equal(s.label, "Email");
  });

  test("competenze: niente doppioni", async () => {
    const agent = ctx.agent();
    await login(agent);
    const token = await csrf(agent, "/admin/skills");
    await agent.post("/admin/skills").field("_csrf", token).field("name", "Docker").attach("icon", await pngBuffer(), "d.png");
    const res = await agent.post("/admin/skills").field("_csrf", token).field("name", "docker");
    assert.equal(res.status, 422);
    assert.equal(await ctx.prisma.skill.count(), 1);
  });
});
