// Applicazione Express: separata da server.ts per poterla avviare anche nei test.
import path from "node:path";
import compression from "compression";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { sessionMiddleware } from "./auth/session";
import type { Config } from "./config";
import type { PrismaClient } from "./generated/prisma/client";
import { messages } from "./i18n/index";
import { adminRouter } from "./routes/admin/index";
import { publicRouter } from "./routes/public";
import { seoRouter } from "./routes/seo";
import { createTranslator, type Translator } from "./services/translate";
import { createUploadStore } from "./services/uploads";

export type AppDeps = {
  prisma: PrismaClient;
  config: Config;
  translator?: Translator;
};

export function createApp({ prisma, config, translator }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", path.join(import.meta.dirname, "views"));
  if (config.isProd) {
    app.set("trust proxy", 1); // dietro Nginx Proxy Manager
    // Il sito passa da Cloudflare: con SSL "Flexible" Cloudflare raggiunge il server in http e NPM passa
    // X-Forwarded-Proto: http. Lo schema vero del visitatore è in CF-Visitor: se era https, la richiesta
    // va trattata come sicura (altrimenti il cookie Secure dell'admin non viene creato e il login non funziona).
    app.use((req, _res, next) => {
      const visitor = req.headers["cf-visitor"];
      if (typeof visitor === "string" && /"scheme"\s*:\s*"https"/.test(visitor)) req.headers["x-forwarded-proto"] = "https";
      next();
    });
  }

  // Un solo indirizzo per il sito: www.<dominio> rimanda in modo permanente al dominio di PUBLIC_URL
  // (per i motori di ricerca due host con la stessa pagina sono contenuto duplicato).
  const canonical = new URL(config.PUBLIC_URL);
  app.use((req, res, next) => {
    if (req.hostname === `www.${canonical.hostname}`) {
      res.redirect(301, new URL(req.originalUrl, canonical).href);
      return;
    }
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "img-src": ["'self'", "data:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "script-src": ["'self'"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'none'"],
          "upgrade-insecure-requests": config.isProd ? [] : null,
        },
      },
      strictTransportSecurity: config.isProd,
    }),
  );

  app.use(compression());

  app.get("/healthz", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  const staticOpts = { maxAge: config.isProd ? "7d" : 0, index: false as const, dotfiles: "deny" as const };
  app.use("/uploads", express.static(config.UPLOAD_DIR, staticOpts));
  app.use("/assets", express.static(path.join(import.meta.dirname, "..", "public", "assets"), staticOpts));
  app.get("/favicon.ico", (_req, res) => res.redirect(301, "/assets/brand/favicon-32.png"));

  const sessions = sessionMiddleware({
    databaseUrl: config.DATABASE_URL,
    secret: config.SESSION_SECRET,
    secure: config.isProd,
  });

  app.use(
    "/admin",
    sessions.middleware,
    adminRouter({
      prisma,
      uploads: createUploadStore(config.UPLOAD_DIR),
      translator: translator ?? createTranslator(config.DEEPL_API_KEY),
      admin: { username: config.ADMIN_USERNAME, passwordHash: config.ADMIN_PASSWORD_HASH },
    }),
  );

  app.use(seoRouter(prisma, { publicUrl: config.PUBLIC_URL }));
  app.use(publicRouter(prisma, { publicUrl: config.PUBLIC_URL, secureCookies: config.isProd }));

  app.use((req, res) => {
    if (req.path.startsWith("/admin")) {
      res.status(404).render("admin/error", { title: "Pagina non trovata", message: "Questa pagina non esiste." });
      return;
    }
    const lang = req.path.startsWith("/en/") ? "en" : "it";
    res.status(404).render("public/404", { lang, t: messages[lang], home: lang === "en" ? "/en/" : "/" });
  });

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(500).render(req.path.startsWith("/admin") ? "admin/error" : "public/500", {
      title: "Errore",
      message: "Qualcosa è andato storto. Riprova tra qualche minuto.",
    });
  };
  app.use(onError);

  return { app, close: sessions.close };
}
