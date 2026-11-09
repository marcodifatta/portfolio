// Popola il database con i contenuti del sito statico attuale (index.html, photo/, docs/cv).
// Gira solo se il database è vuoto, così non sovrascrive mai i dati inseriti dall'admin.
// Per ripartire da zero in sviluppo: npm run db:reset
//
// I testi inglesi restano vuoti: li genera la traduzione automatica (Fase 4).
// I tag tecnologici restano vuoti: si compilano dall'admin.
import "dotenv/config";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createPrisma } from "../src/db";

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

const projects = [
  {
    slug: "pizzabakery",
    titleIt: "PizzaBakery Web Menù",
    descriptionIt:
      "Web Menù per la pizzeria PizzaBakery di Cefalù. Il menù è accessibile sia da telefono che da desktop. L'amministratore può aggiungere, rimuovere e modificare le pizze all'interno di ogni categoria.",
    url: "https://www.pizzabakery.biz",
    year: 2024,
    logo: "photo/project-logos/PizzaBakery.png",
  },
  {
    slug: "qrator",
    titleIt: "QRator - Generatore di codici QR",
    descriptionIt:
      "QRator è un generatore di codici QR gratuito. L'utente inserisce un link nella casella di testo e ottiene un codice QR dentro un file PDF, che viene scaricato.",
    url: "https://qrator.mdfdev.xyz/",
    year: 2024,
    logo: "photo/project-logos/qrator.svg",
  },
  {
    slug: "shoppylist",
    titleIt: "ShoppyList - Gestisci la tua lista della spesa",
    descriptionIt:
      "ShoppyList è un'app web gratuita per la gestione della lista della spesa. L'utente può registrarsi, creare una lista condivisa con altri membri, aggiungere prodotti con quantità e prezzi, e tenere traccia delle spese in modo collaborativo.",
    url: "https://shoppylist.mdfdev.xyz/",
    year: 2025,
    logo: "photo/project-logos/shoppylist.svg",
  },
  {
    slug: "mdkmanager",
    titleIt: "MDK Manager - Il gestionale semplice per la tua struttura ricettiva",
    descriptionIt:
      "MDK Manager è la soluzione semplice e intuitiva per la gestione di strutture ricettive. Ti permette di controllare prenotazioni, ospiti, ricevute e spese da un'unica piattaforma, eliminando file Excel disordinati e riducendo il rischio di errori.",
    url: "https://mdkmanager.mdfdev.xyz/",
    year: 2026,
    logo: "photo/project-logos/MDKM512x512.png",
  },
];

const skills = [
  ["HTML", "photo/icons/logo-html.svg"],
  ["CSS", "photo/icons/logo-css.svg"],
  ["JavaScript", "photo/icons/logo-javascript.svg"],
  ["Node.js", "photo/icons/logo-nodejs.svg"],
  ["MongoDB", "photo/icons/logo-mongodb.svg"],
  ["Python", "photo/icons/logo-python.svg"],
  ["Linux", "photo/icons/logo-linux.svg"],
  ["Docker", "photo/icons/logo-docker.svg"],
] as const;

async function main() {
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`Il database contiene già ${existing} progetti: seed saltato.`);
    return;
  }

  for (const [position, p] of projects.entries()) {
    const logoPath = await importImage(p.logo, "logos", p.slug);
    await prisma.project.create({
      data: {
        slug: p.slug,
        titleIt: p.titleIt,
        descriptionIt: p.descriptionIt,
        url: p.url,
        year: p.year,
        logoPath,
        status: "PUBLISHED",
        position,
      },
    });
  }

  for (const [position, [name, icon]] of skills.entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    await prisma.skill.create({ data: { name, iconPath: await importImage(icon, "skills", slug), position } });
  }

  await prisma.social.createMany({
    data: [
      { kind: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/marco-di-fatta-76728b15b/", position: 0 },
      { kind: "instagram", label: "Instagram", url: "https://www.instagram.com/mdfdev08/", position: 1 },
      { kind: "email", label: "Email", url: "mailto:contact@mdfdev.xyz", position: 2 },
    ],
  });

  const cvDir = path.join(UPLOAD_DIR, "cv");
  await mkdir(cvDir, { recursive: true });
  await copyFile(path.join(ROOT, "docs/cv/MDF_CV_14-2-26.pdf"), path.join(cvDir, "MDF_CV.pdf"));

  await prisma.setting.createMany({
    data: [
      { key: "hero.title", valueIt: "Ciao, sono Marco" },
      {
        key: "hero.subtitle",
        valueIt: "Sono un appassionato di tecnologia e sviluppo: qui trovi i progetti che ho costruito e messo online.",
      },
      { key: "contact.email", valueIt: "contact@mdfdev.xyz" },
      { key: "cv.path", valueIt: "/uploads/cv/MDF_CV.pdf" },
    ],
  });

  console.log(`Seed completato: ${projects.length} progetti, ${skills.length} competenze, 3 social, 4 impostazioni.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
