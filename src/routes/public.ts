// Pagine pubbliche: homepage italiana su "/", inglese su "/en/".
import { Router, type Request, type Response } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { LANG_COOKIE, homePath, messages, pick, preferredLang, type Lang } from "../i18n/index";

const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

export function publicRouter(prisma: PrismaClient, opts: { publicUrl: string; secureCookies: boolean }) {
  // strict: "/en" e "/en/" sono indirizzi diversi (il primo rimanda al secondo)
  const router = Router({ strict: true });

  async function render(res: Response, lang: Lang) {
    const [projects, skills, socials, settingRows] = await Promise.all([
      prisma.project.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
      prisma.skill.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
      prisma.social.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
      prisma.setting.findMany(),
    ]);
    const s = Object.fromEntries(settingRows.map((r) => [r.key, r]));
    const text = (key: string) => (s[key] ? pick(lang, s[key].valueIt, s[key].valueEn) : "");

    res.set("Vary", "Accept-Language, Cookie");
    res.set("Content-Language", lang);
    res.render("public/index", {
      lang,
      t: messages[lang],
      urls: {
        canonical: new URL(homePath(lang), opts.publicUrl).href,
        it: new URL("/", opts.publicUrl).href,
        en: new URL("/en/", opts.publicUrl).href,
        switchTo: `/lang/${lang === "it" ? "en" : "it"}`,
      },
      content: {
        heroTitle: text("hero.title"),
        heroSubtitle: text("hero.subtitle"),
        about: text("about.body"),
        email: s["contact.email"]?.valueIt ?? "",
        cvPath: s["cv.path"]?.valueIt ?? "",
      },
      projects: projects.map((p) => ({
        slug: p.slug,
        title: pick(lang, p.titleIt, p.titleEn),
        description: pick(lang, p.descriptionIt, p.descriptionEn),
        url: p.url,
        year: p.year,
        tags: p.tags,
        logoPath: p.logoPath,
        screenshotPath: p.screenshotPath,
      })),
      skills,
      socials,
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
