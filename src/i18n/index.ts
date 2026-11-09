// Lingue del sito pubblico: italiano su "/", inglese su "/en/".
// I testi fissi stanno in it.ts/en.ts; i contenuti (progetti, testi) arrivano dal DB in entrambe le lingue.
import type { Request } from "express";
import { en } from "./en";
import { it, type Messages } from "./it";

export const LANGS = ["it", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const messages: Record<Lang, Messages> = { it, en };

export const LANG_COOKIE = "lang";

/** Percorso della homepage per una lingua. */
export function homePath(lang: Lang): string {
  return lang === "en" ? "/en/" : "/";
}

/**
 * Alla prima visita di "/" decide se mandare il visitatore su "/en/".
 * - se ha già scelto una lingua (cookie) vale quella;
 * - altrimenti guarda Accept-Language: l'italiano tra le lingue preferite → resta su "/",
 *   altrimenti, se l'inglese è tra le preferite → "/en/".
 */
export function preferredLang(req: Request): Lang | null {
  const cookie = parseCookie(req.headers.cookie ?? "")[LANG_COOKIE];
  if (cookie === "it" || cookie === "en") return cookie;
  const accepted = req.acceptsLanguages();
  for (const tag of accepted) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "it") return "it";
    if (base === "en") return "en";
  }
  return null;
}

function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}

/** Testo localizzato con ripiego sull'italiano quando manca l'inglese. */
export function pick(lang: Lang, itValue: string, enValue: string | null | undefined): string {
  return lang === "en" && enValue ? enValue : itValue;
}
