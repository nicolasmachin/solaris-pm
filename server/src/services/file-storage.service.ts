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
