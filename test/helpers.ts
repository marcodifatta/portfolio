// Utilità comuni ai test: app collegata al database portfolio_test e login dell'admin.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import request from "supertest";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth/password";
import type { Config } from "../src/config";
import { createPrisma } from "../src/db";
import type { Translator } from "../src/services/translate";

export const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgresql://marcodifatta@localhost:5432/portfolio_test";
export const ADMIN_PASSWORD = "password-di-prova-123";

export async function setupApp(opts: { translator?: Translator } = {}) {
  const uploadDir = await mkdtemp(path.join(tmpdir(), "portfolio-test-"));
  const config: Config = {
    NODE_ENV: "test",
    PORT: 0,
    DATABASE_URL: TEST_DATABASE_URL,
    UPLOAD_DIR: uploadDir,
    SESSION_SECRET: "x".repeat(40),
    ADMIN_USERNAME: "marco",
    ADMIN_PASSWORD_HASH: await hashPassword(ADMIN_PASSWORD),
    PUBLIC_URL: "https://mdfdev.xyz",
    DEEPL_API_KEY: undefined,
    isProd: false,
  };
  const prisma = createPrisma(TEST_DATABASE_URL);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "projects", "skills", "socials", "settings", "session", "admin_credentials" RESTART IDENTITY',
  );
  const { app, close } = createApp({ prisma, config, translator: opts.translator });
  return {
    app,
    prisma,
    uploadDir,
    agent: () => request.agent(app),
    async teardown() {
      await close();
      await prisma.$disconnect();
      await rm(uploadDir, { recursive: true, force: true });
    },
  };
}

export function csrfFrom(html: string): string {
  const match = html.match(/name="_csrf" value="([0-9a-f]+)"/);
  if (!match?.[1]) throw new Error("token CSRF non trovato nella pagina");
  return match[1];
}

export async function login(agent: ReturnType<typeof request.agent>, password = ADMIN_PASSWORD) {
  const page = await agent.get("/admin/login");
  return agent
    .post("/admin/login")
    .type("form")
    .send({ _csrf: csrfFrom(page.text), username: "marco", password, next: "/admin/projects" });
}

/** Restituisce il token CSRF della sessione corrente (da una pagina dell'admin). */
export async function csrf(agent: ReturnType<typeof request.agent>, page = "/admin/projects/new") {
  return csrfFrom((await agent.get(page)).text);
}

export function pngBuffer(color = "#5a1a12", width = 64, height = 64): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
}
