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
import { AppError, badRequest } from "../../utils/errors.js";

// Whitelist de adjuntos de lead (Tanda 1): solo PDF, imágenes, Word y Excel.
// Extensión → mimes válidos; se exige que coincidan para resistir renombres.
const LEAD_ATTACHMENT_TYPES: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};
const LEAD_ATTACHMENT_MAX_MB = 10;
const LEAD_ATTACHMENT_TYPE_ERROR =
  "Tipo de archivo no soportado. Se permiten: PDF, JPG, PNG, Word, Excel.";

// Valida extensión + mime de un adjunto de lead. Tira badRequest si no matchea.
// Pura (testeable). Acepta octet-stream cayendo en la extensión.
export function assertAllowedLeadFile(filename: string, mimetype: string | undefined): void {
  const extension = path.extname(filename).toLowerCase();
  const allowedMimes = LEAD_ATTACHMENT_TYPES[extension];
  if (!allowedMimes) {
    throw badRequest("INVALID_FILE_TYPE", LEAD_ATTACHMENT_TYPE_ERROR);
  }
  const mime = (mimetype || "").toLowerCase();
  if (mime && mime !== "application/octet-stream" && !allowedMimes.includes(mime)) {
    throw badRequest("INVALID_FILE_TYPE", LEAD_ATTACHMENT_TYPE_ERROR);
  }
}

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
  assertAllowedLeadFile(file.filename, file.mimetype);
  const extension = path.extname(file.filename).toLowerCase();

  const dir = storageRootForLead(leadId);
  await fsPromises.mkdir(dir, { recursive: true });

  const storedFilename = `${randomUUID()}${extension}`;
  const absolutePath = path.join(dir, storedFilename);
  const writeStream = fs.createWriteStream(absolutePath);

  await pipeline(file.file, writeStream);

  const stats = await fsPromises.stat(absolutePath);
  const maxBytes = LEAD_ATTACHMENT_MAX_MB * 1024 * 1024;
  if (stats.size > maxBytes) {
    await fsPromises.unlink(absolutePath).catch(() => undefined);
    throw new AppError(413, "FILE_TOO_LARGE", `El archivo supera el límite de ${LEAD_ATTACHMENT_MAX_MB} MB.`);
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
    // Las fotos y los videos de la visita de ventas quedan afuera: los mueve
    // `moveLeadMediaToProject`, que además los deja donde el proyecto los
    // muestra (galería de obra y sección Videos) en vez de sueltos entre los
    // documentos.
    where: {
      leadId,
      deletedAt: null,
      OR: [{ toolSource: null }, { toolSource: { notIn: MEDIA_TOOL_SOURCES } }],
    },
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

/** `toolSource` de las fotos y videos de la visita de ventas. */
export const LEAD_FOTO_TOOL_SOURCE = "lead-fotos";
const PROJECT_VIDEO_TOOL_SOURCE = "project-video";
const MEDIA_TOOL_SOURCES = [LEAD_FOTO_TOOL_SOURCE, PROJECT_VIDEO_TOOL_SOURCE];

/**
 * Pasa al proyecto las fotos y los videos que se cargaron en la visita de ventas.
 *
 * Va aparte de `copyLeadAttachmentsToProject` porque no alcanza con copiar el
 * archivo: cada uno tiene que quedar donde el proyecto lo muestra —las fotos en
 * la galería de obra (con su miniatura), los videos en la sección Videos— y el
 * `ProjectVideo` tiene que pasar a apuntar al proyecto.
 *
 * Los videos se **mueven** en vez de copiarse: son decenas de MB y el original
 * del lead ya no se necesita. `leadId` se conserva como rastro de dónde salió.
 */
export async function moveLeadMediaToProject(
  tx: Prisma.TransactionClient,
  leadId: string,
  projectId: string,
  userIdFallback: string,
): Promise<{ fotos: number; videos: number }> {
  let fotos = 0;
  let videos = 0;

  // ── Fotos → galería de obra ──────────────────────────────────────────────
  const fotosLead = await tx.fileAttachment.findMany({
    where: { leadId, toolSource: LEAD_FOTO_TOOL_SOURCE, deletedAt: null },
  });

  if (fotosLead.length > 0) {
    const obraDir = path.join(storageRootForProject(projectId), "obra");
    await fsPromises.mkdir(obraDir, { recursive: true });

    for (const foto of fotosLead) {
      const srcAbs = absolutePathFromUrl(foto.url);
      try {
        await fsPromises.access(srcAbs);
      } catch {
        continue;
      }

      const extension = path.extname(foto.storedFilename) || "";
      const uuid = randomUUID();
      const nuevoNombre = `${uuid}${extension}`;
      await fsPromises.copyFile(srcAbs, path.join(obraDir, nuevoNombre));

      // La miniatura ya existe al lado del original: se copia con el nombre que
      // espera la galería en vez de volver a generarla.
      const thumbSrc = absolutePathFromUrl(deriveThumbUrl(foto.url));
      await fsPromises
        .copyFile(thumbSrc, path.join(obraDir, `thumb_${uuid}.jpg`))
        .catch(() => undefined);

      await tx.fileAttachment.create({
        data: {
          projectId,
          filename: foto.filename,
          storedFilename: nuevoNombre,
          mimeType: foto.mimeType,
          sizeBytes: foto.sizeBytes,
          url: `${projectId}/obra/${nuevoNombre}`,
          toolSource: "obra-fotos",
          uploadedById: foto.uploadedById ?? userIdFallback,
        },
      });
      fotos++;
    }
  }

  // ── Videos → sección Videos del proyecto ─────────────────────────────────
  const videosLead = await tx.projectVideo.findMany({
    where: { leadId, projectId: null, deletedAt: null },
    select: { id: true, posterUrl: true, fileAttachmentId: true, fileAttachment: true },
  });

  if (videosLead.length > 0) {
    const videosDir = path.join(storageRootForProject(projectId), "videos");
    await fsPromises.mkdir(videosDir, { recursive: true });

    for (const video of videosLead) {
      let nuevaUrl: string | null = null;

      if (video.fileAttachment) {
        const srcAbs = absolutePathFromUrl(video.fileAttachment.url);
        const nombre = video.fileAttachment.storedFilename;
        try {
          await fsPromises.rename(srcAbs, path.join(videosDir, nombre));
          nuevaUrl = `${projectId}/videos/${nombre}`;
        } catch {
          // Si el archivo no está, el video queda apuntando al proyecto igual:
          // perder el vínculo sería peor que un adjunto roto.
        }
      }

      let nuevoPoster: string | null = null;
      if (video.posterUrl) {
        const nombrePoster = path.basename(video.posterUrl);
        await fsPromises
          .rename(absolutePathFromUrl(video.posterUrl), path.join(videosDir, nombrePoster))
          .then(() => {
            nuevoPoster = `${projectId}/videos/${nombrePoster}`;
          })
          .catch(() => undefined);
      }

      await tx.projectVideo.update({
        where: { id: video.id },
        data: { projectId, posterUrl: nuevoPoster ?? video.posterUrl },
      });

      if (video.fileAttachmentId && nuevaUrl) {
        await tx.fileAttachment.update({
          where: { id: video.fileAttachmentId },
          data: { projectId, leadId: null, url: nuevaUrl },
        });
      }
      videos++;
    }
  }

  return { fotos, videos };
}

/** `<dir>/<uuid>.<ext>` → `<dir>/thumb_<uuid>.jpg` (convención de la galería). */
function deriveThumbUrl(url: string): string {
  const dir = path.posix.dirname(url);
  const base = path.posix.basename(url);
  const sinExt = base.slice(0, base.length - path.posix.extname(base).length);
  return dir === "." ? `thumb_${sinExt}.jpg` : `${dir}/thumb_${sinExt}.jpg`;
}
