// Pagine pubbliche del portfolio.
import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";

export function publicRouter(prisma: PrismaClient) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const [projects, skills, socials, settingRows] = await Promise.all([
      prisma.project.findMany({ where: { status: "PUBLISHED" }, orderBy: { position: "asc" } }),
      prisma.skill.findMany({ orderBy: { position: "asc" } }),
      prisma.social.findMany({ orderBy: { position: "asc" } }),
      prisma.setting.findMany(),
    ]);
    const settings = Object.fromEntries(settingRows.map((s) => [s.key, s.valueIt]));
    res.render("public/index", { projects, skills, socials, settings });
  });

  return router;
}
