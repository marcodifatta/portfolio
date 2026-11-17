// Punto di avvio: legge la configurazione, collega il database e avvia il server HTTP.
import path from "node:path";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createPrisma } from "./db";
import { initBioLinks } from "./services/bio-links";
import { createUploadStore } from "./services/uploads";

const config = loadConfig();
const prisma = createPrisma(config.DATABASE_URL);
const { app, close } = createApp({ prisma, config });

// Prima volta dopo l'aggiornamento: copia nella tabella bio_links i link che /link mostrava prima.
const bio = await initBioLinks(prisma, createUploadStore(config.UPLOAD_DIR), {
  uploadDir: config.UPLOAD_DIR,
  publicDir: path.join(import.meta.dirname, "..", "public"),
  publicUrl: config.PUBLIC_URL,
});
if (bio) console.log(`Link in bio: ${bio.created} link iniziali creati.`);

const server = app.listen(config.PORT, () => {
  console.log(`Portfolio in ascolto su http://localhost:${config.PORT} (${config.NODE_ENV})`);
  if (!config.DEEPL_API_KEY) console.log("Traduzione automatica disattivata: DEEPL_API_KEY non impostata.");
});

// Chiusura ordinata quando Docker ferma il container
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server.close(async () => {
      await close();
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}
