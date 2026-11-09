// Configurazione letta dalle variabili d'ambiente, validata all'avvio:
// se manca qualcosa il processo si ferma subito con un messaggio chiaro.
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().startsWith("postgresql://", "DATABASE_URL deve iniziare con postgresql://"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configurazione non valida:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  UPLOAD_DIR: path.resolve(parsed.data.UPLOAD_DIR),
  isProd: parsed.data.NODE_ENV === "production",
};
