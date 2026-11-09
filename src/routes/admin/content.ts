// Admin: testi della homepage (titolo, presentazione, Chi sono, email) e CV.
import { Router } from "express";
import { z } from "zod";
import { flash } from "../../auth/session";
import { checkbox, fieldErrors } from "../../lib/forms";
import { UploadError } from "../../services/uploads";
import { multipart, uploadedFile, type AdminDeps } from "./index";

/** Testi modificabili: chiave nel DB, etichetta, lunghezza massima, multilinea, traducibile. */
export const CONTENT_FIELDS = [
  { key: "hero.title", label: "Titolo della homepage", max: 120, multiline: false, translate: true },
  { key: "hero.subtitle", label: "Frase sotto il titolo", max: 300, multiline: true, translate: true },
  { key: "about.body", label: "Chi sono", max: 2000, multiline: true, translate: true },
  { key: "contact.email", label: "Email di contatto", max: 120, multiline: false, translate: false },
] as const;

const emailSchema = z.email("Email non valida");

export function contentRouter({ prisma, uploads, translator }: AdminDeps) {
  const router = Router();

  async function load() {
    const rows = await prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r]));
  }

  router.get("/", async (_req, res) => {
    const settings = await load();
    const values = Object.fromEntries(
      CONTENT_FIELDS.map((f) => [f.key, { it: settings[f.key]?.valueIt ?? "", en: settings[f.key]?.valueEn ?? "", manual: settings[f.key]?.enManual ?? false }]),
    );
    res.render("admin/content", { title: "Testi e CV", fields: CONTENT_FIELDS, values, errors: {}, cvPath: settings["cv.path"]?.valueIt ?? null });
  });

  router.post("/", ...multipart([]), async (req, res) => {
    const settings = await load();
    const values: Record<string, { it: string; en: string; manual: boolean }> = {};
    const errors: Record<string, string> = {};
    for (const f of CONTENT_FIELDS) {
      const it = String(req.body[`${f.key}.it`] ?? "").trim();
      const en = String(req.body[`${f.key}.en`] ?? "").trim();
      values[f.key] = { it, en, manual: checkbox(req.body[`${f.key}.manual`]) };
      if (it.length > f.max || en.length > f.max) errors[f.key] = `Massimo ${f.max} caratteri`;
    }
    if (!values["hero.title"]?.it) errors["hero.title"] = "Il titolo non può essere vuoto";
    const email = values["contact.email"]?.it ?? "";
    if (email) {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) errors["contact.email"] = fieldErrors(parsed.error)._form ?? "Email non valida";
    }
    if (Object.keys(errors).length > 0) {
      res.status(422).render("admin/content", { title: "Testi e CV", fields: CONTENT_FIELDS, values, errors, cvPath: settings["cv.path"]?.valueIt ?? null });
      return;
    }

    const warnings = new Set<string>();
    for (const f of CONTENT_FIELDS) {
      const v = values[f.key]!;
      let en: string | null = v.en || null;
      if (f.translate) {
        const prev = settings[f.key];
        const result = await translator.englishFor({ text: v.it }, { text: en }, { manual: v.manual, previousIt: prev ? { text: prev.valueIt } : null });
        en = result.values.text;
        if (result.warning) warnings.add(result.warning);
      }
      await prisma.setting.upsert({
        where: { key: f.key },
        create: { key: f.key, valueIt: v.it, valueEn: en, enManual: v.manual },
        update: { valueIt: v.it, valueEn: en, enManual: v.manual },
      });
    }
    flash(req, warnings.size ? "error" : "ok", warnings.size ? [...warnings][0]! : "Testi salvati.");
    res.redirect(303, "/admin/content");
  });

  router.post("/cv", ...multipart([{ name: "cv", maxCount: 1 }]), async (req, res) => {
    const file = uploadedFile(req, "cv");
    if (!file) {
      flash(req, "error", "Scegli un file PDF da caricare.");
      res.redirect(303, "/admin/content");
      return;
    }
    try {
      const path = await uploads.savePdf("Marco-Di-Fatta-CV", file);
      const previous = await prisma.setting.findUnique({ where: { key: "cv.path" } });
      await prisma.setting.upsert({ where: { key: "cv.path" }, create: { key: "cv.path", valueIt: path }, update: { valueIt: path } });
      if (previous?.valueIt !== path) await uploads.remove(previous?.valueIt);
      flash(req, "ok", "CV aggiornato.");
    } catch (err) {
      if (!(err instanceof UploadError)) throw err;
      flash(req, "error", err.message);
    }
    res.redirect(303, "/admin/content");
  });

  return router;
}
