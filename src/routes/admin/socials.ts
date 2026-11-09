// Admin: link social e di contatto.
import { Router, type Request } from "express";
import { z } from "zod";
import { flash, verifyCsrf } from "../../auth/session";
import { fieldErrors } from "../../lib/forms";
import { moveItem } from "../../lib/ordering";
import type { AdminDeps } from "./index";

export const SOCIAL_KINDS = {
  linkedin: "LinkedIn",
  github: "GitHub",
  instagram: "Instagram",
  x: "X",
  youtube: "YouTube",
  email: "Email",
  website: "Sito web",
} as const;

const socialSchema = z
  .object({
    kind: z.enum(Object.keys(SOCIAL_KINDS) as [keyof typeof SOCIAL_KINDS, ...(keyof typeof SOCIAL_KINDS)[]], {
      error: "Scegli un tipo",
    }),
    label: z.string().trim().max(40, "Massimo 40 caratteri"),
    url: z.string().trim().min(1, "Inserisci il link"),
  })
  .transform((v, ctx) => {
    let url = v.url;
    if (v.kind === "email") {
      const address = url.replace(/^mailto:/i, "");
      if (!z.email().safeParse(address).success) {
        ctx.addIssue({ code: "custom", path: ["url"], message: "Email non valida" });
        return z.NEVER;
      }
      url = `mailto:${address}`;
    } else if (!z.url({ protocol: /^https?$/ }).safeParse(url).success) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Inserisci un link completo, es. https://..." });
      return z.NEVER;
    }
    return { kind: v.kind, label: v.label || SOCIAL_KINDS[v.kind], url };
  });

export function socialsRouter({ prisma }: AdminDeps) {
  const router = Router();
  const list = () => prisma.social.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  const find = async (req: Request) => {
    const id = Number(req.params.id);
    return Number.isInteger(id) ? prisma.social.findUnique({ where: { id } }) : null;
  };
  const render = async (res: import("express").Response, status = 200, form = { values: { kind: "linkedin", label: "", url: "" }, errors: {} as Record<string, string>, editId: null as number | null }) => {
    res.status(status).render("admin/socials", { title: "Social e contatti", socials: await list(), kinds: SOCIAL_KINDS, ...form });
  };

  router.get("/", async (_req, res) => render(res));

  router.post("/", verifyCsrf, async (req, res) => {
    const parsed = socialSchema.safeParse(req.body);
    if (!parsed.success) {
      await render(res, 422, { values: { kind: req.body.kind ?? "", label: req.body.label ?? "", url: req.body.url ?? "" }, errors: fieldErrors(parsed.error), editId: null });
      return;
    }
    const last = await prisma.social.aggregate({ _max: { position: true } });
    await prisma.social.create({ data: { ...parsed.data, position: (last._max.position ?? -1) + 1 } });
    flash(req, "ok", "Link aggiunto.");
    res.redirect(303, "/admin/socials");
  });

  router.post("/:id", verifyCsrf, async (req, res, next) => {
    const social = await find(req);
    if (!social) return next();
    const parsed = socialSchema.safeParse(req.body);
    if (!parsed.success) {
      await render(res, 422, { values: { kind: req.body.kind ?? "", label: req.body.label ?? "", url: req.body.url ?? "" }, errors: fieldErrors(parsed.error), editId: social.id });
      return;
    }
    await prisma.social.update({ where: { id: social.id }, data: parsed.data });
    flash(req, "ok", "Link aggiornato.");
    res.redirect(303, "/admin/socials");
  });

  router.post("/:id/move", verifyCsrf, async (req, res, next) => {
    const social = await find(req);
    if (!social) return next();
    await moveItem(list, (id, position) => prisma.social.update({ where: { id }, data: { position } }), social.id, req.body.direction === "up" ? "up" : "down");
    res.redirect(303, "/admin/socials");
  });

  router.post("/:id/delete", verifyCsrf, async (req, res, next) => {
    const social = await find(req);
    if (!social) return next();
    await prisma.social.delete({ where: { id: social.id } });
    flash(req, "ok", `"${social.label}" eliminato.`);
    res.redirect(303, "/admin/socials");
  });

  return router;
}
