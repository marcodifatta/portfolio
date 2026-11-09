// Area admin: login/logout e montaggio delle sezioni protette.
import express, { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { verifyPassword } from "../../auth/password";
import { csrfToken, requireAdmin, verifyCsrf } from "../../auth/session";
import type { PrismaClient } from "../../generated/prisma/client";
import type { Translator } from "../../services/translate";
import { MAX_UPLOAD_BYTES, type UploadStore } from "../../services/uploads";
import { contentRouter } from "./content";
import { projectsRouter } from "./projects";
import { skillsRouter } from "./skills";
import { socialsRouter } from "./socials";

export type AdminDeps = {
  prisma: PrismaClient;
  uploads: UploadStore;
  translator: Translator;
  admin: { username: string; passwordHash: string };
};

/** Parser multipart (file in memoria, max 5 MB) seguito dal controllo CSRF. */
export function multipart(fields: { name: string; maxCount: number }[]): RequestHandler[] {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: fields.length, fields: 40 },
  }).fields(fields);
  const parse: RequestHandler = (req, res, next) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE" ? "Il file è troppo grande: massimo 5 MB." : "Caricamento non valido.";
        res.status(413).render("admin/error", { title: "File non accettato", message });
        return;
      }
      next(err);
    });
  };
  return [parse, verifyCsrf];
}

/** Restituisce il file caricato in un campo, se presente e non vuoto. */
export function uploadedFile(req: express.Request, field: string): Buffer | undefined {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const file = files?.[field]?.[0];
  return file && file.size > 0 ? file.buffer : undefined;
}

export function adminRouter(deps: AdminDeps) {
  const router = Router();
  router.use(express.urlencoded({ extended: false, limit: "100kb" }));
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow");
    res.locals.csrf = csrfToken(req);
    res.locals.flash = req.session.flash;
    delete req.session.flash;
    res.locals.admin = req.session.admin;
    res.locals.path = req.path;
    next();
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).render("admin/login", {
        error: "Troppi tentativi. Riprova tra 15 minuti.",
        username: "",
        next: "",
      });
    },
  });

  router.get("/login", (req, res) => {
    if (req.session.admin) {
      res.redirect(303, "/admin");
      return;
    }
    res.render("admin/login", { error: null, username: "", next: String(req.query.next ?? "") });
  });

  router.post("/login", loginLimiter, verifyCsrf, async (req, res, next) => {
    const username = String(req.body.username ?? "").trim();
    const password = String(req.body.password ?? "");
    const target = String(req.body.next ?? "");
    // La password si verifica sempre, anche con utente sbagliato: stessi tempi di risposta
    const passwordOk = await verifyPassword(password, deps.admin.passwordHash);
    if (!passwordOk || username !== deps.admin.username) {
      res.status(401).render("admin/login", { error: "Utente o password non corretti.", username, next: target });
      return;
    }
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.admin = { username, loggedInAt: Date.now() };
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        const safe = target.startsWith("/admin") && !target.startsWith("//") ? target : "/admin";
        res.redirect(303, safe);
      });
    });
  });

  router.post("/logout", verifyCsrf, (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("mdf.sid");
      res.redirect(303, "/admin/login");
    });
  });

  router.use(requireAdmin);
  router.get("/", (_req, res) => res.redirect(303, "/admin/projects"));
  router.use("/projects", projectsRouter(deps));
  router.use("/content", contentRouter(deps));
  router.use("/socials", socialsRouter(deps));
  router.use("/skills", skillsRouter(deps));

  return router;
}
