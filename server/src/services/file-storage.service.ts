import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

import type { MultipartFile } from "@fastify/multipart";

import { env } from "../config/env.js";
import { badRequest } from "../utils/errors.js";

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
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

export async function deleteStoredFile(relativeUrl: string) {
  const absolutePath = path.resolve(process.cwd(), "..", env.storagePath, relativeUrl);
  await fsPromises.unlink(absolutePath).catch(() => undefined);
}

export function getStoredFilePath(relativeUrl: string) {
  return path.resolve(process.cwd(), "..", env.storagePath, relativeUrl);
}
