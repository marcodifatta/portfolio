// SEO e GEO (Generative Engine Optimization): robots.txt, sitemap.xml, llms.txt e i dati strutturati schema.org.
// Tutto è generato dal database, così resta allineato a quello che si inserisce dall'admin.
import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { pick, type Lang } from "../i18n/index";

type SiteData = Awaited<ReturnType<typeof loadSite>>;

export async function loadSite(prisma: PrismaClient) {
  const [projects, skills, socials, settingRows] = await Promise.all([
    prisma.project.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.skill.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.social.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.setting.findMany(),
  ]);
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, r]));
  const dates = [...projects.map((p) => p.updatedAt), ...settingRows.map((s) => s.updatedAt)];
  const lastModified = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date();
  return { projects, skills, socials, settings, lastModified };
}

const JOB: Record<Lang, string> = { it: "Sviluppatore web", en: "Web developer" };

/** Grafo schema.org della homepage: sito, pagina profilo, persona e progetti. */
export function jsonLd(site: SiteData, lang: Lang, base: string): string {
  const url = (path: string) => new URL(path, base).href;
  const page = url(lang === "en" ? "/en/" : "/");
  const text = (key: string) => (site.settings[key] ? pick(lang, site.settings[key].valueIt, site.settings[key].valueEn) : undefined);
  const email = site.settings["contact.email"]?.valueIt;
  const personId = url("/#marco");
  const graph = [
    {
      "@type": "WebSite",
      "@id": url("/#website"),
      url: url("/"),
      name: "Marco Di Fatta",
      inLanguage: ["it", "en"],
      publisher: { "@id": personId },
    },
    {
      "@type": "ProfilePage",
      "@id": `${page}#page`,
      url: page,
      name: text("hero.title"),
      description: text("hero.subtitle"),
      inLanguage: lang,
      isPartOf: { "@id": url("/#website") },
      mainEntity: { "@id": personId },
      dateModified: site.lastModified.toISOString(),
    },
    {
      "@type": "Person",
      "@id": personId,
      name: "Marco Di Fatta",
      url: url("/"),
      image: url("/assets/brand/ritratto-1000.webp"),
      jobTitle: JOB[lang],
      description: text("about.body"),
      ...(email ? { email: `mailto:${email}` } : {}),
      sameAs: site.socials.filter((s) => s.kind !== "email").map((s) => s.url),
      knowsAbout: site.skills.map((s) => s.name),
      knowsLanguage: ["it", "en"],
    },
    {
      "@type": "ItemList",
      "@id": `${page}#progetti`,
      name: lang === "en" ? "Projects" : "Progetti",
      numberOfItems: site.projects.length,
      itemListElement: site.projects.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "WebApplication",
          name: pick(lang, p.titleIt, p.titleEn),
          description: pick(lang, p.descriptionIt, p.descriptionEn),
          url: p.url,
          applicationCategory: "WebApplication",
          operatingSystem: "Web browser",
          ...(p.screenshotPath ? { image: url(p.screenshotPath) } : p.logoPath ? { image: url(p.logoPath) } : {}),
          ...(p.year ? { dateCreated: String(p.year) } : {}),
          ...(p.tags.length ? { keywords: p.tags.join(", ") } : {}),
          creator: { "@id": personId },
        },
      })),
    },
  ];
  // "<" diventa <: nessun testo dal DB può chiudere il tag <script>
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}

const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"];

export function seoRouter(prisma: PrismaClient, opts: { publicUrl: string }) {
  const router = Router();
  const url = (path: string) => new URL(path, opts.publicUrl).href;

  router.get("/robots.txt", (_req, res) => {
    const lines = [
      "# robots.txt di mdfdev.xyz: il portfolio è pubblico, l'area admin no.",
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /lang/",
      "",
      "# Motori di ricerca generativi e assistenti AI: benvenuti (vedi anche /llms.txt)",
      ...AI_CRAWLERS.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", "Disallow: /admin", ""]),
      `Sitemap: ${url("/sitemap.xml")}`,
      "",
    ];
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(lines.join("\n"));
  });

  router.get("/sitemap.xml", async (_req, res) => {
    const site = await loadSite(prisma);
    const lastmod = site.lastModified.toISOString();
    const alternates = [
      `<xhtml:link rel="alternate" hreflang="it" href="${url("/")}"/>`,
      `<xhtml:link rel="alternate" hreflang="en" href="${url("/en/")}"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${url("/")}"/>`,
    ].join("");
    const entry = (loc: string) =>
      `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq>${alternates}</url>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entry(url("/"))}
${entry(url("/en/"))}
</urlset>
`;
    res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(xml);
  });

  // llms.txt (https://llmstxt.org): il sito in Markdown per i modelli linguistici
  router.get("/llms.txt", async (_req, res) => {
    const site = await loadSite(prisma);
    const it = (key: string) => site.settings[key]?.valueIt ?? "";
    const en = (key: string) => site.settings[key]?.valueEn ?? "";
    const email = it("contact.email");
    const cv = it("cv.path");
    const md: string[] = [
      "# Marco Di Fatta",
      "",
      `> ${it("hero.title")}. ${it("hero.subtitle")}`,
      "",
      it("about.body"),
      "",
      "## Progetti online",
      "",
      ...site.projects.map((p) => {
        const meta = [p.year, ...p.tags].filter(Boolean).join(", ");
        return `- [${p.titleIt}](${p.url}): ${p.descriptionIt}${meta ? ` (${meta})` : ""}`;
      }),
      "",
      "## Competenze",
      "",
      site.skills.map((s) => s.name).join(", "),
      "",
      "## Contatti",
      "",
      ...(email ? [`- Email: ${email}`] : []),
      ...site.socials.filter((s) => s.kind !== "email").map((s) => `- ${s.label}: ${s.url}`),
      ...(cv ? [`- [Curriculum (PDF)](${url(cv)})`] : []),
      "",
      "## English",
      "",
      `- [${en("hero.title") || "English version"}](${url("/en/")}): ${en("hero.subtitle")}`,
      ...site.projects.map((p) => `- [${p.titleEn ?? p.titleIt}](${p.url}): ${p.descriptionEn ?? p.descriptionIt}`),
      "",
    ];
    res.type("text/markdown; charset=utf-8").set("Cache-Control", "public, max-age=3600").send(md.join("\n"));
  });

  return router;
}
