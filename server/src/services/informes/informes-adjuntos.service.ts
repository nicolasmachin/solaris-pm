// Adjuntos del módulo Informes. Storage en `${STORAGE_PATH}/informes/{informeId}/`.
// Subida/borrado: solo autor + estado BORRADOR. Descarga/preview: row-level
// (autor o destinatario de un informe ya enviado). Crea el FileAttachment con
// `informeId` como owner directamente (no pasa por el upload genérico).

import fs from "node:fs";

import type { MultipartFile } from "@fastify/multipart";
import { FileAttachmentTipo, InformeEstado } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { conflict, forbidden, notFound } from "../../utils/errors.js";
import {
  deleteStoredFile,
  getStoredFilePath,
  saveUploadedFile,
} from "../file-storage.service.js";
import type { RequestUser } from "./informes.service.js";

async function findInformeOrThrow(informeId: string) {
  const informe = await prisma.informe.findUnique({
    where: { id: informeId },
    select: { id: true, autorId: true, estado: true },
  });
  if (!informe) throw notFound("INFORME_NOT_FOUND", "Informe no encontrado");
  return informe;
}

// Subir un adjunto: solo el autor y solo en BORRADOR.
export async function subirAdjunto(informeId: string, autorId: string, file: MultipartFile) {
  const informe = await findInformeOrThrow(informeId);
  if (informe.autorId !== autorId) throw forbidden("Solo el autor puede adjuntar archivos");
  if (informe.estado !== InformeEstado.BORRADOR) {
    throw conflict("INFORME_NO_BORRADOR", "Solo se pueden adjuntar archivos en BORRADOR");
  }

  const saved = await saveUploadedFile(file, `informes/${informeId}`);
  const attachment = await prisma.fileAttachment.create({
    data: {
      informeId,
      filename: saved.filename,
      storedFilename: saved.storedFilename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      url: saved.url,
      tipo: FileAttachmentTipo.UPLOAD_MANUAL,
      uploadedById: autorId,
    },
  });
  return {
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt.toISOString(),
    downloadUrl: `/api/informes/${informeId}/adjuntos/${attachment.id}/download`,
    previewUrl: `/api/informes/${informeId}/adjuntos/${attachment.id}/preview`,
  };
}

// Borrar un adjunto en BORRADOR: soft-delete de la fila + borrado físico.
export async function borrarAdjunto(informeId: string, fileId: string, autorId: string): Promise<void> {
  const informe = await findInformeOrThrow(informeId);
  if (informe.autorId !== autorId) throw forbidden("Solo el autor puede borrar adjuntos");
  if (informe.estado !== InformeEstado.BORRADOR) {
    throw conflict("INFORME_NO_BORRADOR", "Solo se pueden borrar adjuntos en BORRADOR");
  }

  const adjunto = await prisma.fileAttachment.findFirst({
    where: { id: fileId, informeId, deletedAt: null },
    select: { id: true, url: true },
  });
  if (!adjunto) throw notFound("ADJUNTO_NOT_FOUND", "Adjunto no encontrado");

  await prisma.fileAttachment.update({ where: { id: adjunto.id }, data: { deletedAt: new Date() } });
  await deleteStoredFile(adjunto.url);
}

// Resuelve un adjunto para descarga/preview con guard row-level (autor o
// destinatario de un informe enviado). Devuelve la ruta física para streamear.
export async function obtenerAdjuntoDescarga(informeId: string, fileId: string, user: RequestUser) {
  const informe = await prisma.informe.findUnique({
    where: { id: informeId },
    select: {
      id: true,
      autorId: true,
      estado: true,
      destinatarios: { select: { usuarioId: true } },
    },
  });
  if (!informe) throw notFound("INFORME_NOT_FOUND", "Informe no encontrado");

  const esAutor = informe.autorId === user.id;
  const esDestinatario = informe.destinatarios.some((d) => d.usuarioId === user.id);
  const visible = esAutor || (esDestinatario && informe.estado !== InformeEstado.BORRADOR);
  if (!visible) throw forbidden("No tenés acceso a este informe");

  const adjunto = await prisma.fileAttachment.findFirst({
    where: { id: fileId, informeId, deletedAt: null },
    select: { url: true, mimeType: true, filename: true },
  });
  if (!adjunto) throw notFound("ADJUNTO_NOT_FOUND", "Adjunto no encontrado");

  const absolutePath = getStoredFilePath(adjunto.url);
  if (!fs.existsSync(absolutePath)) {
    throw notFound("FILE_NOT_FOUND", "El archivo no existe en storage");
  }
  return { absolutePath, mimeType: adjunto.mimeType, filename: adjunto.filename };
}
