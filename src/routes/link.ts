// Pagina "link in bio" (/link): un solo indirizzo per Instagram e TikTok con le app e il contatto.
// Le app arrivano dal database (progetti pubblicati, come in homepage); ogni link porta i parametri UTM
// così le visite dai social si distinguono nelle statistiche dei siti.
import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { loadSite } from "./seo";

/** Fonti ammesse in ?src=: tutto il resto diventa "link" (nessun testo libero finisce nei link). */
const SOURCES = ["instagram", "tiktok"] as const;
type Source = (typeof SOURCES)[number] | "link";

/** Ordine e frase di richiamo delle app da spingere; le altre seguono nell'ordine dell'admin. */
const HIGHLIGHTS: Record<string, string> = {
  shoppylist: "Lista della spesa condivisa · 14 giorni di Famiglia+ gratis",
  saldora: "Sconti sui giochi PC con il minimo storico",
  qrator: "QR per link e Wi-Fi, anche dinamici",
  pizzabakery: "Caso reale: il menù digitale di una pizzeria",
};

export function sourceFrom(value: unknown): Source {
  return typeof value === "string" && (SOURCES as readonly string[]).includes(value) ? (value as Source) : "link";
}

/** Aggiunge gli UTM a un link esterno; se l'indirizzo non è valido lo lascia com'è. */
export function withUtm(href: string, source: Source): string {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return href;
    url.searchParams.set("utm_source", source);
    url.searchParams.set("utm_medium", "social");
    url.searchParams.set("utm_campaign", "link_in_bio");
    return url.href;
  } catch {
    return href;
  }
}

type LinkProject = { slug: string; titleIt: string; descriptionIt: string; url: string; logoPath: string | null };

export function orderProjects<T extends LinkProject>(projects: T[]) {
  const rank = (slug: string) => {
    const i = Object.keys(HIGHLIGHTS).indexOf(slug);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  // sort stabile: a parità di rango resta l'ordine dell'admin
  return [...projects].sort((a, b) => rank(a.slug) - rank(b.slug));
}

export function linkRouter(prisma: PrismaClient, opts: { publicUrl: string }) {
  const router = Router({ strict: true });

  router.get("/link", async (req, res) => {
    const source = sourceFrom(req.query["src"]);
    const site = await loadSite(prisma);
    const email = site.settings["contact.email"]?.valueIt ?? "";
    const firstSentence = (text: string) => text.split(/(?<=[.!?])\s/)[0] ?? text;

    res.set("Content-Language", "it");
    res.render("public/link", {
      canonical: new URL("/link", opts.publicUrl).href,
      shareImage: new URL("/assets/brand/share.jpg", opts.publicUrl).href,
      home: withUtm(new URL("/", opts.publicUrl).href, source),
      email,
      projects: orderProjects(site.projects).map((p) => ({
        slug: p.slug,
        title: p.titleIt,
        line: HIGHLIGHTS[p.slug] ?? firstSentence(p.descriptionIt),
        href: withUtm(p.url, source),
        logoPath: p.logoPath,
      })),
      socials: site.socials.filter((s) => s.kind !== "email"),
      year: new Date().getFullYear(),
    });
  });

  router.get("/link/", (_req, res) => res.redirect(301, "/link"));

  return router;
}
