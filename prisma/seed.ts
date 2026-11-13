// Popola il database con i contenuti del sito statico attuale (index.html, photo/, docs/cv).
// Gira solo se il database è vuoto, così non sovrascrive mai i dati inseriti dall'admin.
// Per ripartire da zero in sviluppo: npm run db:reset
//
// I testi inglesi sono tradotti a mano qui; poi li aggiorna la traduzione automatica quando cambia l'italiano.
// I tag tecnologici restano vuoti: si compilano dall'admin (non li conosco con certezza).
// Progetti, loghi e screenshot: prisma/vetrina (vedi vetrina.json).
import "dotenv/config";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createPrisma } from "../src/db";
import { createUploadStore } from "../src/services/uploads";
import { applyVetrina, loadVetrina } from "../src/services/vetrina";

const ROOT = path.resolve(import.meta.dirname, "..");
const UPLOAD_DIR = path.resolve(process.env["UPLOAD_DIR"] ?? "./data/uploads");
const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL mancante");
const prisma = createPrisma(databaseUrl);

/** Copia un'immagine negli upload: i PNG diventano WebP quadrati da 256px, gli SVG restano SVG. */
async function importImage(src: string, folder: string, name: string): Promise<string> {
  const dir = path.join(UPLOAD_DIR, folder);
  await mkdir(dir, { recursive: true });
  const from = path.join(ROOT, src);
  if (src.endsWith(".svg")) {
    await copyFile(from, path.join(dir, `${name}.svg`));
    return `/uploads/${folder}/${name}.svg`;
  }
  await sharp(from)
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toFile(path.join(dir, `${name}.webp`));
  return `/uploads/${folder}/${name}.webp`;
}

// I progetti arrivano da prisma/vetrina/vetrina.json (lo stesso file di "npm run vetrina").

// Icone ufficiali a colori (SVG Logos, VSCode Icons) scaricate con icons.mjs di tasteskill
const skills = [
  ["HTML", "prisma/seed-assets/skills/html-5.svg"],
  ["CSS", "prisma/seed-assets/skills/css.svg"],
  ["JavaScript", "prisma/seed-assets/skills/javascript.svg"],
  ["Node.js", "prisma/seed-assets/skills/nodejs.svg"],
  ["PostgreSQL", "prisma/seed-assets/skills/postgres.svg"],
  ["MongoDB", "prisma/seed-assets/skills/mongodb.svg"],
  ["Python", "prisma/seed-assets/skills/python.svg"],
  ["Linux", "prisma/seed-assets/skills/linux-tux.svg"],
  ["Docker", "prisma/seed-assets/skills/docker.svg"],
] as const;

async function main() {
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`Il database contiene già ${existing} progetti: seed saltato.`);
    return;
  }

  const vetrina = await loadVetrina(path.join(ROOT, "prisma/vetrina/vetrina.json"));
  await applyVetrina(prisma, createUploadStore(UPLOAD_DIR), vetrina, ROOT);


  for (const [position, [name, icon]] of skills.entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    await prisma.skill.create({ data: { name, iconPath: await importImage(icon, "skills", slug), position } });
  }

  await prisma.social.createMany({
    data: [
      { kind: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/marco-di-fatta-76728b15b/", position: 0 },
      { kind: "instagram", label: "Instagram", url: "https://www.instagram.com/mdfdev08/", position: 1 },
      { kind: "email", label: "Email", url: "mailto:mdfdev08@gmail.com", position: 2 },
    ],
  });

  // Immagine della prima schermata: la pagina intera di PizzaBakery (diversa dallo screenshot della card)
  const heroDir = path.join(UPLOAD_DIR, "hero");
  await mkdir(heroDir, { recursive: true });
  await copyFile(path.join(ROOT, "prisma/seed-assets/hero.webp"), path.join(heroDir, "hero.webp"));
  await sharp(path.join(ROOT, "prisma/seed-assets/hero.webp")).resize({ width: 640 }).webp({ quality: 80 }).toFile(path.join(heroDir, "hero-sm.webp"));

  const cvDir = path.join(UPLOAD_DIR, "cv");
  await mkdir(cvDir, { recursive: true });
  await copyFile(path.join(ROOT, "docs/cv/MDF_CV_14-2-26.pdf"), path.join(cvDir, "MDF_CV.pdf"));

  await prisma.setting.createMany({
    data: [
      {
        key: "hero.title",
        valueIt: "Web app su misura per piccole attività",
        valueEn: "Custom web apps for small businesses",
      },
      {
        key: "hero.subtitle",
        valueIt:
          "Sono Marco Di Fatta. Progetto, sviluppo e metto online web app: un menù per una pizzeria, un generatore di codici QR, una lista della spesa condivisa.",
        valueEn:
          "I'm Marco Di Fatta. I design, build and put web apps online: a menu for a pizzeria, a QR code generator, a shared shopping list.",
      },
      {
        key: "about.body",
        valueIt:
          "Il primo progetto è stato il menù web di PizzaBakery, a Cefalù, nel 2024. Da allora costruisco web app che risolvono un problema preciso e le seguo fino alla messa online, server compreso.",
        valueEn:
          "My first project was the web menu for PizzaBakery in Cefalù, in 2024. Since then I build web apps that solve one clear problem, and I take them all the way online, server included.",
      },
      { key: "contact.email", valueIt: "mdfdev08@gmail.com" },
      { key: "cv.path", valueIt: "/uploads/cv/MDF_CV.pdf" },
      { key: "hero.image", valueIt: "/uploads/hero/hero.webp" },
      { key: "hero.project", valueIt: "pizzabakery" },
    ],
  });

  console.log(`Seed completato: ${vetrina.progetti.length} progetti, ${skills.length} competenze, 3 social, 7 impostazioni.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
