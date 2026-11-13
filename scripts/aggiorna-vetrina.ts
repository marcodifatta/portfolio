// Aggiorna la vetrina dei progetti con i contenuti di prisma/vetrina/vetrina.json.
//
//   npm run vetrina                                    in sviluppo
//   docker compose exec portfolio npm run vetrina      in produzione
//
// Crea o aggiorna i progetti del file (per slug), con logo e screenshot convertiti come dall'admin.
// I progetti aggiunti dall'admin e assenti dal file non vengono toccati (finiscono in coda).
import "dotenv/config";
import path from "node:path";
import { createPrisma } from "../src/db";
import { createUploadStore } from "../src/services/uploads";
import { applyVetrina, loadVetrina } from "../src/services/vetrina";

const root = path.resolve(import.meta.dirname, "..");
const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("DATABASE_URL mancante");
  process.exit(1);
}
const prisma = createPrisma(databaseUrl);
try {
  const vetrina = await loadVetrina(path.join(root, "prisma/vetrina/vetrina.json"));
  const uploads = createUploadStore(path.resolve(process.env["UPLOAD_DIR"] ?? "./data/uploads"));
  const { created, updated } = await applyVetrina(prisma, uploads, vetrina, root);
  console.log(`Vetrina aggiornata: ${created.length} nuovi (${created.join(", ") || "-"}), ${updated.length} aggiornati (${updated.join(", ") || "-"}).`);
} finally {
  await prisma.$disconnect();
}
