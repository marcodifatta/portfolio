// Salvataggio dei file caricati dall'admin.
// Le immagini vengono SEMPRE decodificate e ricodificate in WebP con sharp: un file che non
// è davvero un'immagine viene rifiutato, e un SVG con script diventa un'immagine innocua.
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ACCEPTED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif", "svg", "avif", "heif", "tiff"]);

type ImageKind = "logo" | "screenshot" | "skill";

const FOLDERS: Record<ImageKind, string> = { logo: "logos", screenshot: "screenshots", skill: "skills" };

export class UploadError extends Error {}

export function createUploadStore(uploadDir: string) {
  async function write(folder: string, name: string, data: Buffer): Promise<string> {
    const dir = path.join(uploadDir, folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), data);
    return `/uploads/${folder}/${name}`;
  }

  function fileName(base: string, ext: string): string {
    const safe = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";
    return `${safe}-${randomBytes(4).toString("hex")}.${ext}`;
  }

  return {
    async saveImage(kind: ImageKind, base: string, input: Buffer): Promise<string> {
      let format: string | undefined;
      try {
        format = (await sharp(input).metadata()).format;
      } catch {
        throw new UploadError("Il file non è un'immagine valida.");
      }
      if (!format || !ACCEPTED_IMAGE_FORMATS.has(format)) {
        throw new UploadError("Formato non supportato: usa PNG, JPG, WebP, SVG o GIF.");
      }
      const img = sharp(input, { failOn: "error", density: format === "svg" ? 300 : undefined });
      let out: Buffer;
      try {
        if (kind === "screenshot") {
          out = await img
            .rotate()
            .resize(1600, 1000, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
        } else {
          const size = kind === "logo" ? 256 : 128;
          out = await img
            .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 90 })
            .toBuffer();
        }
      } catch {
        throw new UploadError("Non riesco a leggere questa immagine: prova a esportarla di nuovo in PNG.");
      }
      return write(FOLDERS[kind], fileName(base, "webp"), out);
    },

    async savePdf(base: string, input: Buffer): Promise<string> {
      if (input.subarray(0, 5).toString("latin1") !== "%PDF-") {
        throw new UploadError("Il file non è un PDF valido.");
      }
      return write("cv", fileName(base, "pdf"), input);
    },

    /** Cancella un file caricato. Ignora percorsi fuori dalla cartella degli upload. */
    async remove(publicPath: string | null | undefined): Promise<void> {
      if (!publicPath?.startsWith("/uploads/")) return;
      const target = path.resolve(uploadDir, publicPath.slice("/uploads/".length));
      if (!target.startsWith(path.resolve(uploadDir) + path.sep)) return;
      await rm(target, { force: true });
    },
  };
}

export type UploadStore = ReturnType<typeof createUploadStore>;
