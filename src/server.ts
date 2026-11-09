// Punto di avvio: legge la configurazione, collega il database e avvia il server HTTP.
import { createApp } from "./app";
import { config } from "./config";
import { createPrisma } from "./db";

const prisma = createPrisma(config.DATABASE_URL);
const app = createApp(prisma, { uploadDir: config.UPLOAD_DIR, isProd: config.isProd });

const server = app.listen(config.PORT, () => {
  console.log(`Portfolio in ascolto su http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

// Chiusura ordinata quando Docker ferma il container
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}
