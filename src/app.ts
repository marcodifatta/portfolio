// Applicazione Express: separata da server.ts per poterla avviare anche nei test.
import path from "node:path";
import express, { type ErrorRequestHandler } from "express";
import type { PrismaClient } from "./generated/prisma/client";
import { publicRouter } from "./routes/public";

export function createApp(prisma: PrismaClient, opts: { uploadDir: string; isProd: boolean }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", path.join(import.meta.dirname, "views"));
  if (opts.isProd) app.set("trust proxy", 1); // dietro Nginx Proxy Manager

  app.get("/healthz", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use(
    "/uploads",
    express.static(opts.uploadDir, { maxAge: opts.isProd ? "7d" : 0, index: false, dotfiles: "deny" }),
  );
  app.use("/assets", express.static(path.join(import.meta.dirname, "..", "public", "assets"), { index: false }));

  app.use(publicRouter(prisma));

  app.use((_req, res) => {
    res.status(404).render("public/404");
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).render("public/500");
  };
  app.use(onError);

  return app;
}
