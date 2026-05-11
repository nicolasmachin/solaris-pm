// Helpers del módulo Ventas. Hoy solo cubre la gestión de adjuntos de leads
// y la copia de esos adjuntos al proyecto cuando se convierte un lead ganado.
// El resto de la lógica de leads vive todavía en api.routes.ts — refactor
// estructural pendiente.

import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

import type { MultipartFile } from "@fastify/multipart";
import type { Prisma, PrismaClient } from "@prisma/client";

import { env } from "../../config/env.js";
import { badRequest } from "../../utils/errors.js";

// Mismas extensiones que para proyectos (file-storage.service.ts) + un par
// útiles para ventas (xls, doc, ppt).
const ALLOWED_LEAD_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf",
  ".xlsx", ".xls",
  ".docx", ".doc",
  ".pptx", ".ppt",
  ".zip",
  ".txt", ".csv",
]);

function storageRootForLead(leadId: string): string {
  return path.resolve(process.cwd(), "..", env.storagePath, "leads", leadId);
}

function storageRootForProject(projectId: string): string {
  return path.resolve(process.cwd(), "..", env.storagePath, projectId);
}

function absolutePathFromUrl(relativeUrl: string): string {
  return path.resolve(process.cwd(), "..", env.storagePath, relativeUrl);
}

/**
 * Guarda un upload de multipart al storage del lead y devuelve los metadatos
 * para insertar el FileAttachment correspondiente.
 */
export async function saveLeadAttachment(file: MultipartFile, leadId: string) {
  const extension = path.extname(file.filename).toLowerCase();
  if (!ALLOWED_LEAD_EXTENSIONS.has(extension)) {
    throw badRequest("INVALID_FILE_TYPE", "El tipo de archivo no está permitido");
  }

  const dir = storageRootForLead(leadId);
  await fsPromises.mkdir(dir, { recursive: true });

  const storedFilename = `${randomUUID()}${extension}`;
  const absolutePath = path.join(dir, storedFilename);
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
    url: `leads/${leadId}/${storedFilename}`,
  };
}

/**
 * Borra el archivo físico de un adjunto a partir de su URL relativa.
 * Idempotente: no falla si el archivo ya no existe.
 */
export async function deleteLeadAttachmentFile(relativeUrl: string): Promise<void> {
  await fsPromises.unlink(absolutePathFromUrl(relativeUrl)).catch(() => undefined);
}

/**
 * Cuando un lead se convierte en proyecto, copiamos cada FileAttachment del
 * lead al proyecto: archivo físico nuevo + registro nuevo en file_attachments.
 * Los adjuntos del lead se preservan (no se borran).
 *
 * Se ejecuta dentro de la transacción de conversión usando el cliente `tx`.
 */
export async function copyLeadAttachmentsToProject(
  tx: Prisma.TransactionClient,
  leadId: string,
  projectId: string,
  userIdFallback: string,
): Promise<{ copied: number }> {
  const attachments = await tx.fileAttachment.findMany({
    where: { leadId, deletedAt: null },
  });
  if (attachments.length === 0) return { copied: 0 };

  const destDir = storageRootForProject(projectId);
  await fsPromises.mkdir(destDir, { recursive: true });

  let copied = 0;
  for (const att of attachments) {
    const srcAbs = absolutePathFromUrl(att.url);
    // Si el archivo físico no existe (raro), saltamos pero no rompemos la
    // transacción — el lead ya fue ganado y la conversión es importante.
    try {
      await fsPromises.access(srcAbs);
    } catch {
      continue;
    }
    const extension = path.extname(att.storedFilename) || "";
    const newStoredFilename = `${randomUUID()}${extension}`;
    const destAbs = path.join(destDir, newStoredFilename);
    await fsPromises.copyFile(srcAbs, destAbs);

    await tx.fileAttachment.create({
      data: {
        projectId,
        leadId: null,
        filename: att.filename,
        storedFilename: newStoredFilename,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        url: `${projectId}/${newStoredFilename}`,
        tipo: att.tipo,
        toolSource: att.toolSource,
        toolVersion: att.toolVersion,
        toolEntityId: att.toolEntityId,
        uploadedById: att.uploadedById ?? userIdFallback,
      },
    });
    copied++;
  }
  return { copied };
}

/**
 * Path absoluto al archivo físico desde la URL relativa que guarda el
 * FileAttachment. Útil para sendFile / stream de descarga.
 */
export function leadAttachmentAbsolutePath(url: string): string {
  return absolutePathFromUrl(url);
}

// Helper para usar fuera de la transacción si hace falta — wrapper sobre el
// PrismaClient principal.
export async function copyLeadAttachmentsToProjectWithDefaultClient(
  prisma: PrismaClient,
  leadId: string,
  projectId: string,
  userIdFallback: string,
): Promise<{ copied: number }> {
  return prisma.$transaction((tx) =>
    copyLeadAttachmentsToProject(tx, leadId, projectId, userIdFallback),
  );
}
