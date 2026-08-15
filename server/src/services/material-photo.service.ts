// Foto de referencia de un ítem del catálogo de materiales.
//
// El objetivo es identificar visualmente el material: hay ítems de nombre muy
// parecido (perfiles, sujetadores, borneras) que se confunden al comprar o al
// preparar la salida a obra. No es una galería: hay UNA foto por ítem, chica,
// pensada para verse en un popover al pasar el mouse y como miniatura en el
// PDF de la lista de materiales.
//
// Decisiones:
// - Se guarda **solo la versión recomprimida**, no el original. Una foto de
//   celular de 4 MB queda en ~15-25 KB, que es lo que hace viable mostrarlas en
//   listas de 60 filas y embeberlas en el PDF.
// - El formato es **JPEG y no WebP** porque PDFKit solo embebe JPEG y PNG.
// - Los archivos NO son `FileAttachment` ni cuelgan de un proyecto: el ítem es
//   del catálogo global, así que viven en `storage/catalogo/materiales/`.

import { promises as fsPromises } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { MultipartFile } from "@fastify/multipart";
import sharp from "sharp";

import { env } from "../config/env.js";
import { badRequest } from "../utils/errors.js";
import { convertirHeicABufferJpeg, esHeic } from "./heic.service.js";

/**
 * Lado máximo de la imagen guardada. 480px alcanza para el popover (que la
 * muestra a ~240px) y para la miniatura del PDF sin que se vea pixelada.
 */
const MAX_SIDE = 480;
const JPEG_QUALITY = 72;

/**
 * Tamaño máximo del archivo que sube el usuario, antes de recomprimir. Se toma
 * del límite global para no prometer más de lo que deja pasar `@fastify/multipart`.
 */
const maxUploadBytes = () => env.maxFileSizeMb * 1024 * 1024;

/**
 * Igual que el resto de los caminos de subida de fotos: se acepta HEIC (el
 * formato nativo del iPhone) pero no se guarda así. Los navegadores mandan
 * `application/octet-stream` bastante seguido, por eso la extensión es el
 * criterio principal.
 */
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);

const RELATIVE_DIR = path.join("catalogo", "materiales");

function catalogoDirAbsolute(): string {
  return path.resolve(process.cwd(), "..", env.storagePath, RELATIVE_DIR);
}

/** Ruta absoluta a partir de la ruta relativa guardada en `MaterialItem.fotoPath`. */
export function materialPhotoAbsolutePath(relativePath: string): string {
  return path.resolve(process.cwd(), "..", env.storagePath, relativePath);
}

export interface SavedMaterialPhoto {
  /** Ruta relativa al storage, para guardar en `MaterialItem.fotoPath`. */
  relativePath: string;
  sizeBytes: number;
}

/**
 * Reduce y recomprime la imagen. Separado del guardado para que el script de
 * carga masiva (`prisma/scripts/seed-fotos-materiales.ts`) use exactamente el
 * mismo procesamiento que la subida por la app.
 */
export async function procesarFotoMaterial(
  original: Buffer,
  meta: { filename?: string | null; mimetype?: string | null },
): Promise<Buffer> {
  const extension = path.extname(meta.filename ?? "").toLowerCase();
  const heic = esHeic({ filename: meta.filename, mimetype: meta.mimetype });
  if (!ALLOWED_EXTENSIONS.has(extension) && !heic) {
    throw badRequest("INVALID_PHOTO_TYPE", "El archivo tiene que ser una imagen (JPG, PNG, WEBP o HEIC)");
  }
  if (original.length > maxUploadBytes()) {
    throw badRequest("FILE_TOO_LARGE", `La imagen supera el límite de ${env.maxFileSizeMb} MB`);
  }

  // sharp no decodifica HEIC: hay que pasarlo por heic-convert primero o la
  // foto entra pero queda ilegible para todo lo de río abajo.
  const decodificable = heic ? await convertirHeicABufferJpeg(original) : original;

  try {
    return await sharp(decodificable)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    throw badRequest("INVALID_PHOTO", "No se pudo procesar la imagen");
  }
}

/** Escribe una imagen ya procesada en el storage del catálogo. */
export async function guardarFotoMaterialProcesada(procesada: Buffer): Promise<SavedMaterialPhoto> {
  const dir = catalogoDirAbsolute();
  await fsPromises.mkdir(dir, { recursive: true });

  const storedFilename = `${randomUUID()}.jpg`;
  await fsPromises.writeFile(path.join(dir, storedFilename), procesada);

  return {
    relativePath: path.join(RELATIVE_DIR, storedFilename),
    sizeBytes: procesada.length,
  };
}

/**
 * Procesa y guarda la foto de un ítem. Devuelve la ruta relativa; el borrado de
 * la foto anterior queda a cargo del llamador (ver `deleteMaterialPhotoFile`).
 */
export async function saveMaterialItemPhoto(file: MultipartFile): Promise<SavedMaterialPhoto> {
  const original = await file.toBuffer();
  const procesada = await procesarFotoMaterial(original, {
    filename: file.filename,
    mimetype: file.mimetype,
  });
  return guardarFotoMaterialProcesada(procesada);
}

/** Borra el archivo físico. Best-effort: si ya no está, no es un error. */
export async function deleteMaterialPhotoFile(relativePath: string | null | undefined): Promise<void> {
  if (!relativePath) return;
  await fsPromises.unlink(materialPhotoAbsolutePath(relativePath)).catch(() => undefined);
}

/** Lee la foto para embeberla en un PDF. Devuelve null si el archivo no está. */
export async function readMaterialPhotoBuffer(
  relativePath: string | null | undefined,
): Promise<Buffer | null> {
  if (!relativePath) return null;
  try {
    return await fsPromises.readFile(materialPhotoAbsolutePath(relativePath));
  } catch {
    return null;
  }
}
