// Admin: link della pagina "link in bio" (/link). Logo, testo, sottotesto e collegamento di ogni link;
// ordine con le frecce, "Nascondi" per toglierlo dalla pagina senza cancellarlo.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { flash, verifyCsrf } from "../../auth/session";
import { checkbox, fieldErrors } from "../../lib/forms";
import { moveItem } from "../../lib/ordering";
import { UploadError } from "../../services/uploads";
import { multipart, uploadedFile, type AdminDeps } from "./index";

export const bioLinkSchema = z
  .object({
    title: z.string().trim().min(1, "Scrivi il testo del link").max(40, "Massimo 40 caratteri"),
    subtitle: z.string().trim().max(90, "Massimo 90 caratteri").default(""),
    url: z.string().trim().min(1, "Inserisci il collegamento"),
  })
  .transform((v, ctx) => {
    let url = v.url;
    if (/^mailto:/i.test(url) || (url.includes("@") && !url.includes("/"))) {
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
    return { title: v.title, subtitle: v.subtitle, url };
  });

type Values = { title: string; subtitle: string; url: string; visible: boolean };
const EMPTY: Values = { title: "", subtitle: "", url: "", visible: true };

export function bioRouter({ prisma, uploads }: AdminDeps) {
  const router = Router();
  const list = () => prisma.bioLink.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  const find = async (req: Request) => {
    const id = Number(req.params.id);
    return Number.isInteger(id) ? prisma.bioLink.findUnique({ where: { id } }) : null;
  };
  const valuesFrom = (req: Request): Values => ({
    title: String(req.body.title ?? ""),
    subtitle: String(req.body.subtitle ?? ""),
    url: String(req.body.url ?? ""),
    visible: checkbox(req.body.visible),
  });
  const renderList = async (res: Response, status = 200, values: Values = EMPTY, errors: Record<string, string> = {}) => {
    res.status(status).render("admin/bio/list", { title: "Link in bio", links: await list(), values, errors });
  };

  /** Valida il form e salva l'eventuale logo; restituisce i dati o gli errori per campo. */
  const parse = async (req: Request) => {
    const parsed = bioLinkSchema.safeParse(req.body);
    let errors: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);
    let iconPath: string | undefined;
    const icon = uploadedFile(req, "icon");
    if (parsed.success && icon) {
      try {
        iconPath = await uploads.saveImage("bio", parsed.data.title, icon);
      } catch (err) {
        if (!(err instanceof UploadError)) throw err;
        errors = { icon: err.message };
      }
    }
    return parsed.success && !Object.keys(errors).length ? { data: parsed.data, iconPath } : { errors };
  };

  router.get("/", async (_req, res) => renderList(res));

  router.post("/", ...multipart([{ name: "icon", maxCount: 1 }]), async (req, res) => {
    const result = await parse(req);
    if ("errors" in result) return renderList(res, 422, valuesFrom(req), result.errors);
    const last = await prisma.bioLink.aggregate({ _max: { position: true } });
    await prisma.bioLink.create({
      data: { ...result.data, iconPath: result.iconPath ?? null, visible: checkbox(req.body.visible), position: (last._max.position ?? -1) + 1 },
    });
    flash(req, "ok", "Link aggiunto.");
    res.redirect(303, "/admin/bio");
  });

  router.get("/:id", async (req, res, next) => {
    const link = await find(req);
    if (!link) return next();
    res.render("admin/bio/edit", { title: `Modifica ${link.title}`, link, values: link, errors: {} });
  });

  router.post("/:id", ...multipart([{ name: "icon", maxCount: 1 }]), async (req, res, next) => {
    const link = await find(req);
    if (!link) return next();
    const result = await parse(req);
    if ("errors" in result) {
      res.status(422).render("admin/bio/edit", { title: `Modifica ${link.title}`, link, values: valuesFrom(req), errors: result.errors });
      return;
    }
    const removeIcon = checkbox(req.body.removeIcon);
    const iconPath = result.iconPath ?? (removeIcon ? null : link.iconPath);
    await prisma.bioLink.update({ where: { id: link.id }, data: { ...result.data, iconPath, visible: checkbox(req.body.visible) } });
    if (iconPath !== link.iconPath) await uploads.remove(link.iconPath);
    flash(req, "ok", "Link aggiornato.");
    res.redirect(303, "/admin/bio");
  });

  router.post("/:id/visibility", verifyCsrf, async (req, res, next) => {
    const link = await find(req);
    if (!link) return next();
    await prisma.bioLink.update({ where: { id: link.id }, data: { visible: !link.visible } });
    flash(req, "ok", link.visible ? `"${link.title}" nascosto dalla pagina.` : `"${link.title}" di nuovo visibile.`);
    res.redirect(303, "/admin/bio");
  });

  router.post("/:id/move", verifyCsrf, async (req, res, next) => {
    const link = await find(req);
    if (!link) return next();
    await moveItem(list, (id, position) => prisma.bioLink.update({ where: { id }, data: { position } }), link.id, req.body.direction === "up" ? "up" : "down");
    res.redirect(303, "/admin/bio");
  });

  router.post("/:id/delete", verifyCsrf, async (req, res, next) => {
    const link = await find(req);
    if (!link) return next();
    await prisma.bioLink.delete({ where: { id: link.id } });
    await uploads.remove(link.iconPath);
    flash(req, "ok", `"${link.title}" eliminato.`);
    res.redirect(303, "/admin/bio");
  });

  return router;
}
