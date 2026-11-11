// Configurazione letta dalle variabili d'ambiente, validata all'avvio:
// se manca qualcosa il processo si ferma subito con un messaggio chiaro.
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().startsWith("postgresql://", "DATABASE_URL deve iniziare con postgresql://"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET deve avere almeno 32 caratteri (openssl rand -hex 32)"),
  ADMIN_USERNAME: z.string().min(3, "ADMIN_USERNAME mancante"),
  ADMIN_PASSWORD_HASH: z
    .string()
    .regex(/^scrypt:\d+:[0-9a-f]{32}:[0-9a-f]{128}$/, "ADMIN_PASSWORD_HASH non valido: generalo con npm run admin:password"),
  PUBLIC_URL: z.url({ protocol: /^https?$/ }).default("https://mdfdev.net"),
  DEEPL_API_KEY: z.string().optional().transform((v) => (v ? v : undefined)),
});

export type Config = z.infer<typeof schema> & { isProd: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    console.error("Configurazione non valida:");
    for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }
  return {
    ...parsed.data,
    UPLOAD_DIR: path.resolve(parsed.data.UPLOAD_DIR),
    isProd: parsed.data.NODE_ENV === "production",
  };
}
