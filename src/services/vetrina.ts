// Applica i contenuti della vetrina (prisma/vetrina/vetrina.json) al database:
// crea o aggiorna ogni progetto per slug, carica logo e screenshot con lo stesso servizio dell'admin
// (WebP, versioni ridotte, file vecchi cancellati) e ordina la griglia come nel file.
// I progetti che non sono nel file restano com'erano, dopo quelli del file.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import type { UploadStore } from "./uploads";

const entrySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  titleIt: z.string().min(2).max(120),
  titleEn: z.string().min(2).max(120),
  descriptionIt: z.string().min(10).max(1000),
  descriptionEn: z.string().min(10).max(1000),
  url: z.url({ protocol: /^https?$/ }),
  year: z.number().int().min(2000).max(2100).nullable(),
  tags: z.array(z.string().max(30)).max(8),
  logo: z.string().min(1),
  screenshot: z.string().min(1).nullable(),
});

export const vetrinaSchema = z.object({ progetti: z.array(entrySchema).min(1) });
export type Vetrina = z.infer<typeof vetrinaSchema>;

export async function loadVetrina(file: string): Promise<Vetrina> {
  return vetrinaSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

export async function applyVetrina(
  prisma: PrismaClient,
  uploads: UploadStore,
  vetrina: Vetrina,
  root: string,
): Promise<{ created: string[]; updated: string[] }> {
  const created: string[] = [];
  const updated: string[] = [];
  for (const [position, e] of vetrina.progetti.entries()) {
    const existing = await prisma.project.findUnique({ where: { slug: e.slug } });
    const logoPath = await uploads.saveImage("logo", e.slug, await readFile(path.resolve(root, e.logo)));
    const screenshotPath = e.screenshot
      ? await uploads.saveImage("screenshot", e.slug, await readFile(path.resolve(root, e.screenshot)))
      : null;
    const data = {
      titleIt: e.titleIt,
      titleEn: e.titleEn,
      descriptionIt: e.descriptionIt,
      descriptionEn: e.descriptionEn,
      enManual: false,
      url: e.url,
      year: e.year,
      tags: e.tags,
      logoPath,
      screenshotPath,
      status: "PUBLISHED" as const,
      position,
    };
    if (existing) {
      await prisma.project.update({ where: { id: existing.id }, data });
      if (existing.logoPath !== logoPath) await uploads.remove(existing.logoPath);
      if (existing.screenshotPath !== screenshotPath) await uploads.remove(existing.screenshotPath);
      updated.push(e.slug);
    } else {
      await prisma.project.create({ data: { ...data, slug: e.slug } });
      created.push(e.slug);
    }
  }
  // gli altri progetti (aggiunti dall'admin) vanno in coda, nel loro ordine
  const slugs = vetrina.progetti.map((e) => e.slug);
  const others = await prisma.project.findMany({
    where: { slug: { notIn: slugs } },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });
  for (const [i, p] of others.entries()) {
    await prisma.project.update({ where: { id: p.id }, data: { position: slugs.length + i } });
  }
  return { created, updated };
}
