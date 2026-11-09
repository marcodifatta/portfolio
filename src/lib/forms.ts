// Utilità per i form dell'admin: validazione con zod ed errori per campo.
import type { z } from "zod";

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    out[key] ??= issue.message;
  }
  return out;
}

export function checkbox(value: unknown): boolean {
  return value === "on" || value === "true" || value === "1";
}

export function slugify(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "progetto"
  );
}

/** Rende unico uno slug aggiungendo -2, -3... */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  let slug = base;
  for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
  return slug;
}
