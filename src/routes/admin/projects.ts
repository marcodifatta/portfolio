// Admin: elenco, creazione, modifica, riordino ed eliminazione dei progetti.
import { Router, type Request } from "express";
import { z } from "zod";
import { flash, verifyCsrf } from "../../auth/session";
import type { Project } from "../../generated/prisma/client";
import { checkbox, fieldErrors, slugify, uniqueSlug, type FieldErrors } from "../../lib/forms";
import { moveItem } from "../../lib/ordering";
import { UploadError } from "../../services/uploads";
import { multipart, uploadedFile, type AdminDeps } from "./index";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Massimo ${max} caratteri`)
    .transform((v) => (v === "" ? null : v));

const projectSchema = z.object({
  titleIt: z.string().trim().min(2, "Scrivi un titolo").max(120, "Massimo 120 caratteri"),
  descriptionIt: z.string().trim().min(10, "Scrivi almeno una frase").max(1000, "Massimo 1000 caratteri"),
  titleEn: optionalText(120),
  descriptionEn: optionalText(1000),
  url: z.string().trim().pipe(z.url({ protocol: /^https?$/, error: "Inserisci un link completo, es. https://..." })),
  year: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 2000 || n > 2100) {
        ctx.addIssue({ code: "custom", message: "Anno non valido" });
        return z.NEVER;
      }
      return n;
    }),
  tags: z
    .string()
    .transform((v) => [...new Set(v.split(",").map((t) => t.trim()).filter(Boolean))])
    .pipe(z.array(z.string().max(30, "Ogni tag al massimo 30 caratteri")).max(8, "Al massimo 8 tag")),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  enManual: z.boolean(),
});

type ProjectInput = z.infer<typeof projectSchema>;

function formValues(body: Record<string, unknown>) {
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  return {
    titleIt: s("titleIt"),
    descriptionIt: s("descriptionIt"),
    titleEn: s("titleEn"),
    descriptionEn: s("descriptionEn"),
    url: s("url"),
    year: s("year"),
    tags: s("tags"),
    status: s("status") || "DRAFT",
    enManual: checkbox(body.enManual),
  };
}

function valuesFromProject(p: Project) {
  return {
    titleIt: p.titleIt,
    descriptionIt: p.descriptionIt,
    titleEn: p.titleEn ?? "",
    descriptionEn: p.descriptionEn ?? "",
    url: p.url,
    year: p.year ? String(p.year) : "",
    tags: p.tags.join(", "),
    status: p.status,
    enManual: p.enManual,
  };
}

export function projectsRouter({ prisma, uploads, translator }: AdminDeps) {
  const router = Router();
  const upload = multipart([
    { name: "logo", maxCount: 1 },
    { name: "screenshot", maxCount: 1 },
  ]);

  const findProject = async (req: Request) => {
    const id = Number(req.params.id);
    return Number.isInteger(id) ? prisma.project.findUnique({ where: { id } }) : null;
  };

  router.get("/", async (_req, res) => {
    const projects = await prisma.project.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
    res.render("admin/projects/list", { title: "Progetti", projects });
  });

  router.get("/new", (_req, res) => {
    res.render("admin/projects/form", { title: "Nuovo progetto", project: null, values: formValues({}), errors: {} });
  });

  /** Valida il form, salva i file e scrive su DB. Restituisce gli errori o null se tutto ok. */
  async function save(req: Request, existing: Project | null): Promise<FieldErrors | null> {
    const raw = formValues(req.body);
    const parsed = projectSchema.safeParse(raw);
    if (!parsed.success) return fieldErrors(parsed.error);
    const data: ProjectInput = parsed.data;

    const slug =
      existing?.slug ??
      (await uniqueSlug(slugify(data.titleIt), async (s) => (await prisma.project.count({ where: { slug: s } })) > 0));

    const files: { logoPath?: string; screenshotPath?: string | null } = {};
    try {
      const logo = uploadedFile(req, "logo");
      if (logo) files.logoPath = await uploads.saveImage("logo", slug, logo);
      const shot = uploadedFile(req, "screenshot");
      if (shot) files.screenshotPath = await uploads.saveImage("screenshot", slug, shot);
      else if (existing && checkbox(req.body.removeScreenshot)) files.screenshotPath = null;
    } catch (err) {
      if (err instanceof UploadError) return { [uploadedFile(req, "screenshot") ? "screenshot" : "logo"]: err.message };
      throw err;
    }

    const en = await translator.englishFor(
      { title: data.titleIt, description: data.descriptionIt },
      { title: data.titleEn, description: data.descriptionEn },
      {
        manual: data.enManual,
        previousIt: existing ? { title: existing.titleIt, description: existing.descriptionIt } : null,
      },
    );
    if (en.warning) flash(req, "error", en.warning);

    const record = {
      titleIt: data.titleIt,
      descriptionIt: data.descriptionIt,
      titleEn: en.values.title,
      descriptionEn: en.values.description,
      enManual: data.enManual,
      url: data.url,
      year: data.year,
      tags: data.tags,
      status: data.status,
      ...files,
    };

    if (existing) {
      await prisma.project.update({ where: { id: existing.id }, data: record });
      if (files.logoPath) await uploads.remove(existing.logoPath);
      if (files.screenshotPath !== undefined) await uploads.remove(existing.screenshotPath);
    } else {
      const last = await prisma.project.aggregate({ _max: { position: true } });
      await prisma.project.create({ data: { ...record, slug, position: (last._max.position ?? -1) + 1 } });
    }
    return null;
  }

  router.post("/", ...upload, async (req, res) => {
    const errors = await save(req, null);
    if (errors) {
      res.status(422).render("admin/projects/form", {
        title: "Nuovo progetto",
        project: null,
        values: formValues(req.body),
        errors,
      });
      return;
    }
    if (!req.session.flash) flash(req, "ok", "Progetto creato.");
    res.redirect(303, "/admin/projects");
  });

  router.get("/:id/edit", async (req, res, next) => {
    const project = await findProject(req);
    if (!project) return next();
    res.render("admin/projects/form", {
      title: `Modifica ${project.titleIt}`,
      project,
      values: valuesFromProject(project),
      errors: {},
    });
  });

  router.post("/:id", ...upload, async (req, res, next) => {
    const project = await findProject(req);
    if (!project) return next();
    const errors = await save(req, project);
    if (errors) {
      res.status(422).render("admin/projects/form", {
        title: `Modifica ${project.titleIt}`,
        project,
        values: formValues(req.body),
        errors,
      });
      return;
    }
    if (!req.session.flash) flash(req, "ok", "Modifiche salvate.");
    res.redirect(303, "/admin/projects");
  });

  router.post("/:id/move", verifyCsrf, async (req, res, next) => {
    const project = await findProject(req);
    if (!project) return next();
    await moveItem(
      () => prisma.project.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, position: true } }),
      (id, position) => prisma.project.update({ where: { id }, data: { position } }),
      project.id,
      req.body.direction === "up" ? "up" : "down",
    );
    res.redirect(303, "/admin/projects");
  });

  router.post("/:id/status", verifyCsrf, async (req, res, next) => {
    const project = await findProject(req);
    if (!project) return next();
    const status = project.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await prisma.project.update({ where: { id: project.id }, data: { status } });
    flash(req, "ok", status === "PUBLISHED" ? `"${project.titleIt}" è visibile sul sito.` : `"${project.titleIt}" è ora una bozza.`);
    res.redirect(303, "/admin/projects");
  });

  router.get("/:id/delete", async (req, res, next) => {
    const project = await findProject(req);
    if (!project) return next();
    res.render("admin/projects/delete", { title: "Elimina progetto", project });
  });

  router.post("/:id/delete", verifyCsrf, async (req, res, next) => {
    const project = await findProject(req);
    if (!project) return next();
    await prisma.project.delete({ where: { id: project.id } });
    await uploads.remove(project.logoPath);
    await uploads.remove(project.screenshotPath);
    flash(req, "ok", `"${project.titleIt}" eliminato.`);
    res.redirect(303, "/admin/projects");
  });

  return router;
}
