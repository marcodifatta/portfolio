// Pagine pubbliche: homepage italiana su "/", inglese su "/en/".
import { Router, type Request, type Response } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { LANG_COOKIE, homePath, messages, pick, preferredLang, type Lang } from "../i18n/index";
import { jsonLd, loadSite } from "./seo";

const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

/** "3 web app online dal 2024": solo con numeri veri; senza anni noti la riga non compare. */
function noticeLine(lang: Lang, count: number, firstYear: number): string | null {
  if (count === 0 || !Number.isFinite(firstYear) || firstYear === 9999) return null;
  const t = messages[lang].hero;
  return (count === 1 ? t.noticeOne : t.notice).replace("{n}", String(count)).replace("{year}", String(firstYear));
}

type Item = { slug: string; title: string; url: string; year: number | null; screenshotPath: string | null };

function heroFor<T extends Item>(items: T[], image: string | undefined, slug: string | undefined) {
  const withShot = items.find((p) => p.screenshotPath) ?? null;
  const chosen = (slug && items.find((p) => p.slug === slug)) || null;
  return {
    heroImage: image || withShot?.screenshotPath || null,
    heroProject: chosen ?? (image ? items[0] ?? null : withShot),
  };
}

export function publicRouter(prisma: PrismaClient, opts: { publicUrl: string; secureCookies: boolean }) {
  // strict: "/en" e "/en/" sono indirizzi diversi (il primo rimanda al secondo)
  const router = Router({ strict: true });

  async function render(res: Response, lang: Lang) {
    const site = await loadSite(prisma);
    const { projects, skills, socials } = site;
    const s = site.settings;
    const text = (key: string) => (s[key] ? pick(lang, s[key].valueIt, s[key].valueEn) : "");
    const items = projects.map((p) => ({
      slug: p.slug,
      title: pick(lang, p.titleIt, p.titleEn),
      description: pick(lang, p.descriptionIt, p.descriptionEn),
      url: p.url,
      year: p.year,
      tags: p.tags,
      logoPath: p.logoPath,
      screenshotPath: p.screenshotPath,
    }));

    res.set("Vary", "Accept-Language, Cookie");
    res.set("Content-Language", lang);
    res.render("public/index", {
      lang,
      t: messages[lang],
      urls: {
        canonical: new URL(homePath(lang), opts.publicUrl).href,
        it: new URL("/", opts.publicUrl).href,
        en: new URL("/en/", opts.publicUrl).href,
        switchTo: messages[lang].langSwitch.href,
        base: new URL("/", opts.publicUrl).href,
      },
      content: {
        heroTitle: text("hero.title"),
        heroSubtitle: text("hero.subtitle"),
        about: text("about.body"),
        email: s["contact.email"]?.valueIt ?? "",
        cvPath: s["cv.path"]?.valueIt ?? "",
      },
      projects: items,
      skills,
      socials,
      notice: noticeLine(lang, projects.length, Math.min(...projects.map((p) => p.year ?? 9999))),
      // prima schermata: l'immagine scelta nell'admin, altrimenti lo screenshot del primo progetto che ne ha uno;
      // la scheda sopra cita il progetto scelto (se pubblicato), altrimenti quello dello screenshot
      ...heroFor(items, s["hero.image"]?.valueIt, s["hero.project"]?.valueIt),
      jsonLd: jsonLd(site, lang, opts.publicUrl),
      lastModified: site.lastModified.toISOString(),
      year: new Date().getFullYear(),
    });
  }

  router.get("/", async (req, res) => {
    if (preferredLang(req) === "en") {
      res.set("Vary", "Accept-Language, Cookie");
      res.redirect(302, "/en/");
      return;
    }
    await render(res, "it");
  });

  router.get("/en", (_req, res) => res.redirect(301, "/en/"));
  router.get("/en/", async (_req, res) => render(res, "en"));

  // Selettore di lingua: ricorda la scelta per un anno
  router.get("/lang/:lang", (req: Request, res) => {
    const lang: Lang = req.params.lang === "en" ? "en" : "it";
    res.cookie(LANG_COOKIE, lang, { maxAge: ONE_YEAR, sameSite: "lax", httpOnly: true, secure: opts.secureCookies });
    res.redirect(303, homePath(lang));
  });

  return router;
}
