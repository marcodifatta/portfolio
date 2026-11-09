// Sessioni dell'admin salvate in Postgres (tabella "session", creata dalle migrazioni Prisma),
// protezione CSRF e controllo dell'accesso.
import { randomBytes, timingSafeEqual } from "node:crypto";
import connectPgSimple from "connect-pg-simple";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import session from "express-session";
import pg from "pg";

declare module "express-session" {
  interface SessionData {
    admin?: { username: string; loggedInAt: number };
    csrf?: string;
    flash?: { type: "ok" | "error"; text: string };
  }
}

export function sessionMiddleware(opts: { databaseUrl: string; secret: string; secure: boolean }): {
  middleware: RequestHandler;
  close: () => Promise<void>;
} {
  const pool = new pg.Pool({ connectionString: opts.databaseUrl, max: 3 });
  const PgStore = connectPgSimple(session);
  const store = new PgStore({ pool, tableName: "session", createTableIfMissing: false, pruneSessionInterval: 60 * 60 });
  const middleware = session({
    name: "mdf.sid",
    secret: opts.secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: "lax", secure: opts.secure, maxAge: 7 * 24 * 60 * 60 * 1000 },
  });
  return {
    middleware,
    close: async () => {
      store.close();
      await pool.end();
    },
  };
}

/** Token CSRF legato alla sessione: va in ogni form come campo nascosto _csrf. */
export function csrfToken(req: Request): string {
  if (!req.session.csrf) req.session.csrf = randomBytes(32).toString("hex");
  return req.session.csrf;
}

/** Da mettere dopo il parser del body (urlencoded o multer) su ogni POST dell'admin. */
export const verifyCsrf: RequestHandler = (req, res, next) => {
  const sent = typeof req.body?._csrf === "string" ? req.body._csrf : "";
  const expected = req.session.csrf ?? "";
  const ok =
    sent.length > 0 && sent.length === expected.length && timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!ok) {
    res.status(403).render("admin/error", { title: "Sessione scaduta", message: "Ricarica la pagina e riprova." });
    return;
  }
  next();
};

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.admin) {
    next();
    return;
  }
  res.redirect(303, `/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
}

export function flash(req: Request, type: "ok" | "error", text: string): void {
  req.session.flash = { type, text };
}
