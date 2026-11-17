// Pagina "link in bio" (/link): un solo indirizzo per Instagram e TikTok con le app e il contatto.
// I link arrivano dalla tabella bio_links (sezione "Link in bio" dell'admin), solo quelli visibili e
// nell'ordine scelto; ogni link web porta i parametri UTM così le visite dai social si distinguono.
import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { loadSite } from "./seo";

/** Fonti ammesse in ?src=: tutto il resto diventa "link" (nessun testo libero finisce nei link). */
const SOURCES = ["instagram", "tiktok"] as const;
type Source = (typeof SOURCES)[number] | "link";

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

export function linkRouter(prisma: PrismaClient, opts: { publicUrl: string }) {
  const router = Router({ strict: true });

  router.get("/link", async (req, res) => {
    const source = sourceFrom(req.query["src"]);
    const [site, links] = await Promise.all([
      loadSite(prisma),
      prisma.bioLink.findMany({ where: { visible: true }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
    ]);
    const email = site.settings["contact.email"]?.valueIt ?? "";

    res.set("Content-Language", "it");
    res.render("public/link", {
      canonical: new URL("/link", opts.publicUrl).href,
      shareImage: new URL("/assets/brand/share.jpg", opts.publicUrl).href,
      email,
      links: links.map((l) => ({
        id: l.id,
        title: l.title,
        subtitle: l.subtitle,
        href: withUtm(l.url, source),
        iconPath: l.iconPath,
      })),
      socials: site.socials.filter((s) => s.kind !== "email"),
      year: new Date().getFullYear(),
    });
  });

  router.get("/link/", (_req, res) => res.redirect(301, "/link"));

  return router;
}
