import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

import type { MultipartFile } from "@fastify/multipart";

import { env } from "../config/env.js";
import { badRequest } from "../utils/errors.js";

const allowedExtensions = new Set([
  // Imágenes
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  // Audio (visitas técnicas — iOS Safari graba en m4a/mp4, otros browsers en webm)
  ".webm",
  ".mp4",
  ".m4a",
  ".aac",
  ".mp3",
  ".ogg",
  ".oga",
  ".wav",
  // Documentos
  ".pdf",
  ".dwg",
  ".xlsx",
  ".docx",
  ".zip",
]);

export async function saveUploadedFile(file: MultipartFile, projectId: string) {
  const extension = path.extname(file.filename).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    throw badRequest("INVALID_FILE_TYPE", "El tipo de archivo no está permitido");
  }

  const storageRoot = path.resolve(process.cwd(), "..", env.storagePath, projectId);
  await fsPromises.mkdir(storageRoot, { recursive: true });

  const storedFilename = `${randomUUID()}${extension}`;
  const absolutePath = path.join(storageRoot, storedFilename);
  const writeStream = fs.createWriteStream(absolutePath);

  await pipeline(file.file, writeStream);

  const stats = await fsPromises.stat(absolutePath);
  const maxBytes = env.maxFileSizeMb * 1024 * 1024;
  if (stats.size > maxBytes) {
    await fsPromises.unlink(absolutePath).catch(() => undefined);
    throw badRequest("FILE_TOO_LARGE", `El archivo supera el límite de ${env.maxFileSizeMb} MB`);
  }

  return {
    filename: file.filename,
    storedFilename,
    mimeType: file.mimetype || "application/octet-stream",
    sizeBytes: stats.size,
    absolutePath,
    url: `${projectId}/${storedFilename}`,
  };
}

/**
 * Guarda un Buffer al storage del proyecto y devuelve los metadatos para
 * crear un `FileAttachment`. Útil para archivos generados por el server (no
 * uploads del usuario) — ej. unifilares en PDF.
 */
export async function saveBufferAsAttachment(
  buffer: Uint8Array | Buffer,
  filename: string,
  mimeType: string,
  projectId: string,
) {
  const extension = path.extname(filename).toLowerCase() || ".bin";
  const storageRoot = path.resolve(process.cwd(), "..", env.storagePath, projectId);
  await fsPromises.mkdir(storageRoot, { recursive: true });

  const storedFilename = `${randomUUID()}${extension}`;
  const absolutePath = path.join(storageRoot, storedFilename);
  await fsPromises.writeFile(absolutePath, buffer);

  const stats = await fsPromises.stat(absolutePath);
  return {
    filename,
    storedFilename,
    mimeType,
    sizeBytes: stats.size,
    absolutePath,
    url: `${projectId}/${storedFilename}`,
  };
}

export async function deleteStoredFile(relativeUrl: string) {
  const absolutePath = path.resolve(process.cwd(), "..", env.storagePath, relativeUrl);
  await fsPromises.unlink(absolutePath).catch(() => undefined);
}

export function getStoredFilePath(relativeUrl: string) {
  return path.resolve(process.cwd(), "..", env.storagePath, relativeUrl);
}

/**
 * Construye un filename legible para un FileAttachment generado por una
 * herramienta interna del backend (Unifilar, PreIngeniería, EFP, Consolidador
 * de Materiales, ProposalGenerator, Triángulos, etc.).
 *
 * **SOLO para generadores AUTOMÁTICOS.**
 *
 * **NO usar para uploads manuales del usuario.** El filename de un upload
 * manual debe preservar tal cual el `File.name` que vino del input HTML —
 * el usuario eligió ese nombre y cualquier renombrado pierde su intención
 * (ej: el usuario subió "presupuesto_juan.pdf"; renombrarlo a algo distinto
 * confunde). Para uploads usar `saveUploadedFile(file, projectId)` que ya
 * preserva `file.filename`.
 *
 * **Convención generada**: `<toolSource>_<sanitizedClientName>_v<version>.<ext>`.
 *
 * Ejemplos:
 *   buildToolGeneratedFilename({ toolSource: 'unifilar', projectClientName: 'José Pérez', version: 3, extension: 'pdf' })
 *     → 'unifilar_JosePerez_v3.pdf'
 *
 *   buildToolGeneratedFilename({ toolSource: 'preingenieria', projectClientName: 'Estación de Servicio Petrobras', version: 1, extension: 'pdf' })
 *     → 'preingenieria_EstaciondeServicioPetrobras_v1.pdf'
 *
 *   buildToolGeneratedFilename({ toolSource: 'materiales', version: 2, extension: 'xlsx' })
 *     → 'materiales_<timestamp>_v2.xlsx'  // sin clientName: fallback timestamp
 *
 * **Sanitización del clientName**:
 *   1. Normalize NFD para descomponer acentos en base + combining marks.
 *   2. Strip combining marks (rango U+0300-U+036F): "José" → "Jose".
 *   3. Eliminar todo lo que no sea [a-zA-Z0-9]: espacios, puntuación, ñ se
 *      pierde (se descompone a "n" + tilde, queda "n"), emojis, etc.
 *   4. Truncar a 40 chars para evitar nombres absurdamente largos.
 *
 * Si querés agregar un helper similar para casos con identifier distinto
 * (ej: leadCode en lugar de clientName), agregalo como variante explícita
 * en este mismo archivo — la convención del filename debe vivir acá, no
 * dispersa en cada caller.
 */
export function buildToolGeneratedFilename(params: {
  toolSource: string; // ej "unifilar", "preingenieria", "materiales", "efp"
  projectClientName?: string | null;
  version?: number | null;
  extension: string; // sin punto: "pdf", "xlsx", "jpg"
}): string {
  const sanitize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // combining diacritical marks
      .replace(/[^a-zA-Z0-9]+/g, "")
      .substring(0, 40);

  const parts: string[] = [params.toolSource];

  const cleanedClient = params.projectClientName ? sanitize(params.projectClientName) : "";
  if (cleanedClient.length > 0) {
    parts.push(cleanedClient);
  } else {
    // Fallback: timestamp epoch para garantizar unicidad cuando no hay
    // contexto de proyecto. Evita colisiones de filename idénticos.
    parts.push(String(Date.now()));
  }

  if (params.version != null) {
    parts.push(`v${params.version}`);
  }

  return `${parts.join("_")}.${params.extension}`;
}
