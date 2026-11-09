// Configurazione di Prisma 7: l'URL del database non sta più in schema.prisma.
// Prisma non carica il .env da solo, quindi lo importiamo qui (in produzione
// DATABASE_URL arriva dall'ambiente del container).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
