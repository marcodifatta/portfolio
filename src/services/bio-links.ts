// Link della pagina "link in bio" (/link): riempimento iniziale della tabella bio_links.
// Gira all'avvio del server una sola volta (impostazione "bio.initialized"): copia nella tabella i link
// che la pagina mostrava prima della sezione admin, con una copia propria dei loghi, così cambiare o
// eliminare un progetto non rompe l'icona del link. Dopo, i link si gestiscono solo dall'admin.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "../generated/prisma/client";
import type { UploadStore } from "./uploads";

const INITIALIZED = "bio.initialized";

/** I link iniziali: app in evidenza (per slug del progetto) e, in fondo, il portfolio. */
const STARTER = [
  { slug: "shoppylist", subtitle: "Lista della spesa condivisa · 14 giorni di Famiglia+ gratis" },
  { slug: "saldora", subtitle: "Sconti sui giochi PC con il minimo storico" },
  { slug: "qrator", subtitle: "QR per link e Wi-Fi, anche dinamici" },
  { slug: "pizzabakery", subtitle: "Caso reale: il menù digitale di una pizzeria" },
];

export async function initBioLinks(
  prisma: PrismaClient,
  uploads: UploadStore,
  opts: { uploadDir: string; publicDir: string; publicUrl: string },
): Promise<{ created: number } | null> {
  if (await prisma.setting.findUnique({ where: { key: INITIALIZED } })) return null;

  const rows: { title: string; subtitle: string; url: string; icon: string | null }[] = [];
  if ((await prisma.bioLink.count()) === 0) {
    const projects = await prisma.project.findMany({ where: { slug: { in: STARTER.map((s) => s.slug) }, status: "PUBLISHED" } });
    for (const s of STARTER) {
      const p = projects.find((x) => x.slug === s.slug);
      if (!p) continue;
      const icon = p.logoPath?.startsWith("/uploads/") ? path.join(opts.uploadDir, p.logoPath.slice("/uploads/".length)) : null;
      rows.push({ title: p.titleIt, subtitle: s.subtitle, url: p.url, icon });
    }
    rows.push({
      title: "Portfolio",
      subtitle: "Tutti i progetti e chi sono",
      url: new URL("/", opts.publicUrl).href,
      icon: path.join(opts.publicDir, "assets", "brand", "logo-288.webp"),
    });
  }

  for (const [position, row] of rows.entries()) {
    let iconPath: string | null = null;
    if (row.icon) {
      try {
        iconPath = await uploads.saveImage("bio", row.title, await readFile(row.icon));
      } catch {
        iconPath = null; // logo mancante o illeggibile: il link resta, con l'iniziale al posto dell'icona
      }
    }
    await prisma.bioLink.create({ data: { title: row.title, subtitle: row.subtitle, url: row.url, iconPath, position } });
  }
  await prisma.setting.create({ data: { key: INITIALIZED, valueIt: new Date().toISOString() } });
  return { created: rows.length };
}
