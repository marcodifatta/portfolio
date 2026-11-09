// Admin: competenze (tecnologie con icona).
import { Router, type Request } from "express";
import { z } from "zod";
import { flash, verifyCsrf } from "../../auth/session";
import { fieldErrors } from "../../lib/forms";
import { moveItem } from "../../lib/ordering";
import { UploadError } from "../../services/uploads";
import { multipart, uploadedFile, type AdminDeps } from "./index";

const skillSchema = z.object({ name: z.string().trim().min(1, "Scrivi il nome").max(40, "Massimo 40 caratteri") });

export function skillsRouter({ prisma, uploads }: AdminDeps) {
  const router = Router();
  const list = () => prisma.skill.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  const find = async (req: Request) => {
    const id = Number(req.params.id);
    return Number.isInteger(id) ? prisma.skill.findUnique({ where: { id } }) : null;
  };

  router.get("/", async (_req, res) => {
    res.render("admin/skills", { title: "Competenze", skills: await list(), values: { name: "" }, errors: {} });
  });

  router.post("/", ...multipart([{ name: "icon", maxCount: 1 }]), async (req, res) => {
    const parsed = skillSchema.safeParse(req.body);
    let errors: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);
    if (parsed.success && (await prisma.skill.count({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } })) > 0) {
      errors = { name: "Questa competenza c'è già" };
    }
    let iconPath: string | null = null;
    const icon = uploadedFile(req, "icon");
    if (!Object.keys(errors).length && icon) {
      try {
        iconPath = await uploads.saveImage("skill", parsed.data!.name, icon);
      } catch (err) {
        if (!(err instanceof UploadError)) throw err;
        errors = { icon: err.message };
      }
    }
    if (Object.keys(errors).length || !parsed.success) {
      res.status(422).render("admin/skills", { title: "Competenze", skills: await list(), values: { name: req.body.name ?? "" }, errors });
      return;
    }
    const last = await prisma.skill.aggregate({ _max: { position: true } });
    await prisma.skill.create({ data: { name: parsed.data.name, iconPath, position: (last._max.position ?? -1) + 1 } });
    flash(req, "ok", "Competenza aggiunta.");
    res.redirect(303, "/admin/skills");
  });

  router.post("/:id/move", verifyCsrf, async (req, res, next) => {
    const skill = await find(req);
    if (!skill) return next();
    await moveItem(list, (id, position) => prisma.skill.update({ where: { id }, data: { position } }), skill.id, req.body.direction === "up" ? "up" : "down");
    res.redirect(303, "/admin/skills");
  });

  router.post("/:id/delete", verifyCsrf, async (req, res, next) => {
    const skill = await find(req);
    if (!skill) return next();
    await prisma.skill.delete({ where: { id: skill.id } });
    await uploads.remove(skill.iconPath);
    flash(req, "ok", `"${skill.name}" eliminata.`);
    res.redirect(303, "/admin/skills");
  });

  return router;
}
