import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

import type { MultipartFile } from "@fastify/multipart";
import sharp from "sharp";

import { env } from "../config/env.js";
import { badRequest } from "../utils/errors.js";
import { convertirArchivoHeicAJpeg, esHeic, renombrarAJpeg } from "./heic.service.js";

const allowedExtensions = new Set([
  // Imágenes. `.heic`/`.heif` (el formato nativo del iPhone) se aceptan pero no
  // se guardan así: se convierten a JPEG al entrar (ver heic.service.ts).
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
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

  let storedFilename = `${randomUUID()}${extension}`;
  let absolutePath = path.join(storageRoot, storedFilename);
  const writeStream = fs.createWriteStream(absolutePath);

  await pipeline(file.file, writeStream);

  const stats = await fsPromises.stat(absolutePath);
  const maxBytes = env.maxFileSizeMb * 1024 * 1024;
  if (stats.size > maxBytes) {
    await fsPromises.unlink(absolutePath).catch(() => undefined);
    throw badRequest("FILE_TOO_LARGE", `El archivo supera el límite de ${env.maxFileSizeMb} MB`);
  }

  // El límite se controla sobre lo que subió el usuario; recién después se
  // convierte, para no gastar CPU decodificando un archivo que igual se rechaza.
  const heic = esHeic({ filename: file.filename, mimetype: file.mimetype });
  let filename = file.filename;
  let mimeType = file.mimetype || "application/octet-stream";
  let sizeBytes = stats.size;

  if (heic) {
    const convertido = await convertirArchivoHeicAJpeg(absolutePath);
    absolutePath = convertido.absolutePath;
    storedFilename = convertido.storedFilename;
    sizeBytes = convertido.sizeBytes;
    filename = renombrarAJpeg(file.filename);
    mimeType = "image/jpeg";
  }

  return {
    filename,
    storedFilename,
    mimeType,
    sizeBytes,
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

// ============================================================
// OBRA PHOTOS — galería de fotos de obra
// ============================================================

// `.heic`/`.heif` entran acá igual que en la allowlist global: se aceptan al
// subir y se convierten a JPEG antes de guardarse.
const obraPhotoExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const OBRA_THUMB_WIDTH = 400;
const OBRA_THUMB_QUALITY = 70;

export interface SavedObraPhoto {
  filename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  thumbnailUrl: string;
}

/**
 * Guarda una foto de obra bajo `storage/<projectId>/obra/`, conservando el
 * original tal cual (sin recomprimir) y generando un thumbnail JPEG de 400px
 * de ancho en la misma carpeta (`thumb_<uuid>.jpg`).
 */
export async function saveObraPhoto(
  file: MultipartFile,
  projectId: string,
): Promise<SavedObraPhoto> {
  const extension = path.extname(file.filename).toLowerCase();
  if (!obraPhotoExtensions.has(extension)) {
    throw badRequest("INVALID_PHOTO_TYPE", "El tipo de imagen no está permitido");
  }

  const obraRoot = path.resolve(process.cwd(), "..", env.storagePath, projectId, "obra");
  await fsPromises.mkdir(obraRoot, { recursive: true });

  const uuid = randomUUID();
  let storedFilename = `${uuid}${extension}`;
  let absolutePath = path.join(obraRoot, storedFilename);

  // Guardar el ORIGINAL tal cual (stream, sin re-comprimir).
  const writeStream = fs.createWriteStream(absolutePath);
  await pipeline(file.file, writeStream);

  const stats = await fsPromises.stat(absolutePath);
  const maxBytes = env.maxFileSizeMb * 1024 * 1024;
  if (stats.size > maxBytes) {
    await fsPromises.unlink(absolutePath).catch(() => undefined);
    throw badRequest("FILE_TOO_LARGE", `El archivo supera el límite de ${env.maxFileSizeMb} MB`);
  }

  // El HEIC del iPhone se convierte antes de la miniatura: sharp no lo
  // decodifica, así que sin esto el thumbnail fallaría y la foto quedaría
  // guardada pero invisible en la galería.
  let filename = file.filename;
  let mimeType = file.mimetype || "application/octet-stream";
  let sizeBytes = stats.size;

  if (esHeic({ filename: file.filename, mimetype: file.mimetype })) {
    const convertido = await convertirArchivoHeicAJpeg(absolutePath);
    absolutePath = convertido.absolutePath;
    storedFilename = convertido.storedFilename;
    sizeBytes = convertido.sizeBytes;
    filename = renombrarAJpeg(file.filename);
    mimeType = "image/jpeg";
  }

  // Generar thumbnail en la misma carpeta obra.
  const thumbStoredFilename = `thumb_${uuid}.jpg`;
  const thumbAbsolutePath = path.join(obraRoot, thumbStoredFilename);
  await sharp(absolutePath)
    .rotate()
    .resize({ width: OBRA_THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: OBRA_THUMB_QUALITY })
    .toFile(thumbAbsolutePath);

  return {
    filename,
    storedFilename,
    mimeType,
    sizeBytes,
    url: `${projectId}/obra/${storedFilename}`,
    thumbnailUrl: `${projectId}/obra/${thumbStoredFilename}`,
  };
}

// ============================================================
// VIDEOS DE ENSAYOS — evidencia de obra (anti-isla, encendido)
// ============================================================

/**
 * Allowlist propia, separada de `allowedExtensions`. `.mp4` y `.webm` ya están
 * en la global pero como contenedores de AUDIO (visitas técnicas); acá se suman
 * los formatos que realmente salen de una cámara — sobre todo `.mov`, que es el
 * default del iPhone y hoy la global rechaza.
 */
const projectVideoExtensions = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".3gp", ".avi"]);

/**
 * Mimetypes aceptados, comparados por su base para tolerar el sufijo
 * `;codecs=...` que agregan algunos navegadores. Mismo criterio que usan las
 * visitas técnicas para el audio.
 *
 * A diferencia del resto de los uploads —donde el mimetype del cliente se
 * persiste sin mirar— acá sí se valida: el archivo va a pasar por ffmpeg, y
 * conviene rechazar temprano lo que obviamente no es un video.
 */
const ALLOWED_VIDEO_BASE_MIMES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/webm",
  "video/x-matroska",
  "video/3gpp",
  "video/x-msvideo",
  // Algunos clientes (y varios navegadores en Android) mandan esto para un
  // archivo que sí es video; la validación real la hace ffprobe después.
  "application/octet-stream",
]);

export interface SavedProjectVideoUpload {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  absolutePath: string;
}

/**
 * Carpeta del dueño del video dentro de `storage/`: `<projectId>` cuando es de
 * un proyecto, `leads/<leadId>` cuando se grabó en la visita de ventas y el
 * proyecto todavía no existe.
 */
export function videoOwnerDir(owner: { projectId?: string | null; leadId?: string | null }): string {
  if (owner.projectId) return owner.projectId;
  if (owner.leadId) return `leads/${owner.leadId}`;
  throw badRequest("VIDEO_SIN_DUENO", "El video tiene que pertenecer a un proyecto o a un lead");
}

/**
 * Guarda el video **original** en `storage/<owner>/videos/.tmp/`, a la espera de
 * que la cola lo comprima. Es intencional que quede en un directorio aparte:
 * `.tmp/` está excluido del respaldo a B2 (no tiene sentido subir a la nube un
 * archivo que se va a descartar en minutos) y hace evidente qué sobró si un
 * proceso muere a mitad de camino.
 *
 * El original se borra apenas la compresión termina bien.
 */
export async function saveProjectVideoUpload(
  file: MultipartFile,
  ownerDir: string,
): Promise<SavedProjectVideoUpload> {
  const extension = path.extname(file.filename).toLowerCase();
  if (!projectVideoExtensions.has(extension)) {
    throw badRequest(
      "INVALID_VIDEO_TYPE",
      "El formato de video no está permitido. Formatos aceptados: MP4, MOV, WEBM, MKV, 3GP, AVI",
    );
  }

  const baseMime = (file.mimetype || "").split(";")[0].trim().toLowerCase();
  if (baseMime && !ALLOWED_VIDEO_BASE_MIMES.has(baseMime)) {
    throw badRequest("INVALID_VIDEO_TYPE", "El archivo no parece ser un video");
  }

  const tmpRoot = path.resolve(process.cwd(), "..", env.storagePath, ownerDir, "videos", ".tmp");
  await fsPromises.mkdir(tmpRoot, { recursive: true });

  const absolutePath = path.join(tmpRoot, `${randomUUID()}${extension}`);
  const writeStream = fs.createWriteStream(absolutePath);
  await pipeline(file.file, writeStream);

  const stats = await fsPromises.stat(absolutePath);
  const maxBytes = env.maxVideoSizeMb * 1024 * 1024;
  if (stats.size > maxBytes) {
    await fsPromises.unlink(absolutePath).catch(() => undefined);
    throw badRequest(
      "FILE_TOO_LARGE",
      `El video supera el límite de ${env.maxVideoSizeMb} MB. Probá grabar en 1080p en vez de 4K, o subir un clip más corto.`,
    );
  }

  return {
    filename: file.filename,
    mimeType: file.mimetype || "application/octet-stream",
    sizeBytes: stats.size,
    absolutePath,
  };
}

/** Carpeta definitiva de los videos ya comprimidos de un proyecto o un lead. */
export async function ensureProjectVideoDir(ownerDir: string): Promise<string> {
  const dir = path.resolve(process.cwd(), "..", env.storagePath, ownerDir, "videos");
  await fsPromises.mkdir(dir, { recursive: true });
  return dir;
}

// ============================================================
// FOTOS DE LEAD — relevamiento de la visita de ventas
// ============================================================

/**
 * Guarda una foto de la visita de ventas bajo `storage/leads/<leadId>/fotos/`,
 * con su miniatura al lado. Mismo criterio que las fotos de obra: el original se
 * conserva tal cual (ya viene comprimido desde el navegador) y la miniatura es
 * lo que carga la galería.
 */
export async function saveLeadPhoto(
  file: MultipartFile,
  leadId: string,
): Promise<SavedObraPhoto> {
  const extension = path.extname(file.filename).toLowerCase();
  if (!obraPhotoExtensions.has(extension)) {
    throw badRequest("INVALID_PHOTO_TYPE", "El tipo de imagen no está permitido");
  }

  const root = path.resolve(process.cwd(), "..", env.storagePath, "leads", leadId, "fotos");
  await fsPromises.mkdir(root, { recursive: true });

  const uuid = randomUUID();
  let storedFilename = `${uuid}${extension}`;
  let absolutePath = path.join(root, storedFilename);

  const writeStream = fs.createWriteStream(absolutePath);
  await pipeline(file.file, writeStream);

  const stats = await fsPromises.stat(absolutePath);
  const maxBytes = env.maxFileSizeMb * 1024 * 1024;
  if (stats.size > maxBytes) {
    await fsPromises.unlink(absolutePath).catch(() => undefined);
    throw badRequest("FILE_TOO_LARGE", `El archivo supera el límite de ${env.maxFileSizeMb} MB`);
  }

  let filename = file.filename;
  let mimeType = file.mimetype || "application/octet-stream";
  let sizeBytes = stats.size;

  if (esHeic({ filename: file.filename, mimetype: file.mimetype })) {
    const convertido = await convertirArchivoHeicAJpeg(absolutePath);
    absolutePath = convertido.absolutePath;
    storedFilename = convertido.storedFilename;
    sizeBytes = convertido.sizeBytes;
    filename = renombrarAJpeg(file.filename);
    mimeType = "image/jpeg";
  }

  const thumbStoredFilename = `thumb_${uuid}.jpg`;
  await sharp(absolutePath)
    .rotate()
    .resize({ width: OBRA_THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: OBRA_THUMB_QUALITY })
    .toFile(path.join(root, thumbStoredFilename));

  return {
    filename,
    storedFilename,
    mimeType,
    sizeBytes,
    url: `leads/${leadId}/fotos/${storedFilename}`,
    thumbnailUrl: `leads/${leadId}/fotos/${thumbStoredFilename}`,
  };
}

/**
 * Dado un `url` de foto de obra (`<projectId>/obra/<uuid>.<ext>`), devuelve el
 * url del thumbnail correspondiente (`<projectId>/obra/thumb_<uuid>.jpg`).
 */
export function deriveObraThumbUrl(url: string): string {
  const dir = path.posix.dirname(url);
  const base = path.posix.basename(url);
  const baseNoExt = base.slice(0, base.length - path.posix.extname(base).length);
  const thumbName = `thumb_${baseNoExt}.jpg`;
  return dir === "." ? thumbName : `${dir}/${thumbName}`;
}

/**
 * Borra del filesystem el original de una foto de obra y su thumbnail
 * (best-effort: ignora si no existen).
 */
export async function deleteObraPhotoFiles(url: string): Promise<void> {
  await deleteStoredFile(url);
  await deleteStoredFile(deriveObraThumbUrl(url));
}
