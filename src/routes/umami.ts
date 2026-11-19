// Statistiche di visita con Umami (senza cookie), servite dallo stesso dominio: il browser chiede
// /u/script.js e invia le visite a /u/api/send, e qui le giriamo al container Umami dello stack di
// steamgames (rete db-net). Così niente richieste a terzi e la CSP resta 'self'.
import express, { type Request, type Response } from "express";

// Intestazioni utili a Umami: browser e lingua, IP reale (Cloudflare, usato per paese e visitatori
// unici e non salvato) e le sue cache.
const DA_INOLTRARE = ["user-agent", "accept-language", "content-type", "cf-connecting-ip", "x-umami-cache", "x-umami-website-id", "x-umami-hostname"];

export function umamiRouter(umamiUrl = "http://steamgames-umami:3000") {
  const router = express.Router();
  const base = umamiUrl.replace(/\/+$/, "");

  async function inoltra(req: Request, res: Response, percorso: string, body?: Buffer) {
    const headers: Record<string, string> = {};
    for (const nome of DA_INOLTRARE) {
      const valore = req.headers[nome];
      if (typeof valore === "string") headers[nome] = valore;
    }
    try {
      const risposta = await fetch(`${base}${percorso}`, {
        method: req.method,
        headers,
        body: body && body.length ? new Uint8Array(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });
      res.status(risposta.status);
      const tipo = risposta.headers.get("content-type");
      if (tipo) res.type(tipo);
      if (percorso === "/script.js") res.set("Cache-Control", "public, max-age=86400");
      else res.set("Cache-Control", "no-store");
      res.send(Buffer.from(await risposta.arrayBuffer()));
    } catch {
      // Umami spento o lento: le statistiche non devono mai rompere il sito.
      res.status(204).end();
    }
  }

  router.get("/u/script.js", (req, res) => inoltra(req, res, "/script.js"));
  router.post("/u/api/send", express.raw({ type: () => true, limit: "64kb" }), (req, res) =>
    inoltra(req, res, "/api/send", Buffer.isBuffer(req.body) ? req.body : undefined),
  );
  return router;
}
