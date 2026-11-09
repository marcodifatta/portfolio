// Area admin: login/logout e montaggio delle sezioni protette.
import express, { Router, type RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import multer from "multer";
import { hashPassword, verifyPassword } from "../../auth/password";
import { z } from "zod";
import { csrfToken, flash, requireAdmin, verifyCsrf } from "../../auth/session";
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

  /** Hash in uso: quello cambiato dal pannello (tabella admin_credentials), altrimenti quello del .env. */
  async function currentHash(): Promise<string> {
    const row = await deps.prisma.adminCredential.findUnique({ where: { id: 1 } });
    return row?.passwordHash ?? deps.admin.passwordHash;
  }

  // Il sito passa da Cloudflare: l'IP del visitatore arriva in CF-Connecting-IP. Il limite globale qui sotto
  // copre chi prova a falsificare l'intestazione chiamando il server direttamente.
  const clientKey = (req: express.Request) => ipKeyGenerator(String(req.headers["cf-connecting-ip"] ?? req.ip ?? "0.0.0.0"));
  const tooMany = (_req: express.Request, res: express.Response) => {
    res.status(429).render("admin/login", { error: "Troppi tentativi. Riprova tra 15 minuti.", username: "", next: "" });
  };
  const globalLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    skipSuccessfulRequests: true,
    keyGenerator: () => "tutti",
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooMany,
  });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: clientKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooMany,
  });

  router.get("/login", (req, res) => {
    if (req.session.admin) {
      res.redirect(303, "/admin");
      return;
    }
    res.render("admin/login", { error: null, username: "", next: String(req.query.next ?? "") });
  });

  router.post("/login", globalLoginLimiter, loginLimiter, verifyCsrf, async (req, res, next) => {
    const username = String(req.body.username ?? "").trim();
    const password = String(req.body.password ?? "");
    const target = String(req.body.next ?? "");
    // La password si verifica sempre, anche con utente sbagliato: stessi tempi di risposta
    const passwordOk = await verifyPassword(password, await currentHash());
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

  // Cambio password (da loggati): chiede quella attuale, salva il nuovo hash nel DB e chiude le altre sessioni
  const passwordSchema = z
    .object({
      current: z.string().min(1, "Scrivi la password attuale"),
      next: z.string().min(12, "Almeno 12 caratteri").max(200, "Al massimo 200 caratteri"),
      confirm: z.string(),
    })
    .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Le due password non coincidono" })
    .refine((v) => v.next !== v.current, { path: ["next"], message: "Scegli una password diversa da quella attuale" });

  const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: clientKey, standardHeaders: "draft-8", legacyHeaders: false });

  router.get("/password", (_req, res) => {
    res.render("admin/password", { title: "Cambia password", errors: {} });
  });

  router.post("/password", passwordLimiter, verifyCsrf, async (req, res, next) => {
    const parsed = passwordSchema.safeParse({
      current: String(req.body.current ?? ""),
      next: String(req.body.next ?? ""),
      confirm: String(req.body.confirm ?? ""),
    });
    const errors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    } else if (!(await verifyPassword(parsed.data.current, await currentHash()))) {
      errors.current = "La password attuale non è corretta";
    }
    if (Object.keys(errors).length || !parsed.success) {
      res.status(422).render("admin/password", { title: "Cambia password", errors });
      return;
    }
    const passwordHash = await hashPassword(parsed.data.next);
    await deps.prisma.adminCredential.upsert({ where: { id: 1 }, create: { id: 1, passwordHash }, update: { passwordHash } });
    // le altre sessioni (altri browser o dispositivi) vengono chiuse; questa resta e riceve un nuovo id
    await deps.prisma.session.deleteMany({ where: { sid: { not: req.sessionID } } });
    const admin = req.session.admin;
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.admin = admin;
      flash(req, "ok", "Password cambiata. Le altre sessioni aperte sono state chiuse.");
      req.session.save((saveErr) => (saveErr ? next(saveErr) : res.redirect(303, "/admin/projects")));
    });
  });

  return router;
}
