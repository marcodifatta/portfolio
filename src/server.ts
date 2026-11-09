// Punto di avvio: legge la configurazione, collega il database e avvia il server HTTP.
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createPrisma } from "./db";

const config = loadConfig();
const prisma = createPrisma(config.DATABASE_URL);
const { app, close } = createApp({ prisma, config });

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
