/**
 * El video o la foto de un aviso: sale en un SEGUNDO mensaje de WhatsApp, un par
 * de minutos después del texto (nunca antes). Es otra plantilla de Meta, con el
 * archivo en la cabecera y su propio texto.
 *
 *  - El archivo se sube desde Administración y se guarda en
 *    storage/avisos/<id del aviso>/. Meta lo baja al mandar, de una dirección
 *    pública con un token que no se puede adivinar (`urlPublica()`).
 *  - Límites de WhatsApp: video MP4 hasta 16 MB, foto JPG o PNG hasta 5 MB.
 *
 * Ver docs/manual/20-avisos-automaticos.md.
 */

import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";

/** Cuánto después del texto sale el video o la foto. */
export const DEMORA_ADJUNTO_MS = 90_000;

export const TIPOS_ADJUNTO = {
  "video/mp4": { tipo: "VIDEO", ext: ".mp4", maxMb: 16 },
  "image/jpeg": { tipo: "IMAGEN", ext: ".jpg", maxMb: 5 },
  "image/png": { tipo: "IMAGEN", ext: ".png", maxMb: 5 },
} as const;

type MimeAdjunto = keyof typeof TIPOS_ADJUNTO;

function raizAvisos(): string {
  return path.resolve(process.cwd(), "..", env.storagePath, "avisos");
}

export function rutaAbsoluta(archivo: string): string {
  const abs = path.resolve(raizAvisos(), archivo);
  if (!abs.startsWith(raizAvisos() + path.sep)) throw badRequest("RUTA_INVALIDA", "Ruta de archivo inválida.");
  return abs;
}

/** La dirección pública de donde Meta baja el archivo. */
export function urlPublica(token: string): string {
  return `${process.env.PUBLIC_APP_URL || "https://app.voltia.com.uy"}/api/publico/avisos/adjunto/${token}`;
}

/** Guarda (o reemplaza) el archivo del aviso. Cambiar de video a foto obliga a una plantilla nueva. */
export async function guardarAdjunto(avisoId: string, archivo: { buffer: Buffer; mimetype: string; filename: string }) {
  const aviso = await prisma.avisoAutomatico.findFirst({ where: { id: avisoId, deletedAt: null } });
  if (!aviso) throw notFound("AVISO_NO_ENCONTRADO", "El aviso no existe.");
  if (aviso.canal !== "WHATSAPP") throw badRequest("NO_ES_WHATSAPP", "El video o la foto solo van en los avisos de WhatsApp.");
  const def = TIPOS_ADJUNTO[archivo.mimetype as MimeAdjunto];
  if (!def) throw badRequest("TIPO_INVALIDO", "WhatsApp acepta un video MP4 o una foto JPG o PNG.");
  if (archivo.buffer.length > def.maxMb * 1024 * 1024) {
    throw badRequest("MUY_GRANDE", `WhatsApp acepta ${def.tipo === "VIDEO" ? "videos" : "fotos"} de hasta ${def.maxMb} MB.`);
  }
  const relativo = path.join(avisoId, `${randomUUID()}${def.ext}`);
  await fsPromises.mkdir(path.dirname(rutaAbsoluta(relativo)), { recursive: true });
  await fsPromises.writeFile(rutaAbsoluta(relativo), archivo.buffer);
  if (aviso.adjuntoArchivo) await fsPromises.unlink(rutaAbsoluta(aviso.adjuntoArchivo)).catch(() => undefined);

  const cambiaTipo = aviso.adjuntoTipo !== null && aviso.adjuntoTipo !== def.tipo;
  return prisma.avisoAutomatico.update({
    where: { id: avisoId },
    data: {
      adjuntoTipo: def.tipo,
      adjuntoArchivo: relativo,
      adjuntoMime: archivo.mimetype,
      adjuntoNombre: archivo.filename,
      adjuntoToken: aviso.adjuntoToken ?? randomBytes(24).toString("base64url"),
      // La plantilla aprobada sirve para cualquier archivo del mismo tipo: solo se
      // vuelve a aprobar si cambia de video a foto o al revés.
      ...(cambiaTipo ? sinPlantillaAdjunto() : {}),
    },
  });
}

export async function quitarAdjunto(avisoId: string) {
  const aviso = await prisma.avisoAutomatico.findFirst({ where: { id: avisoId, deletedAt: null } });
  if (!aviso) throw notFound("AVISO_NO_ENCONTRADO", "El aviso no existe.");
  if (aviso.adjuntoArchivo) await fsPromises.unlink(rutaAbsoluta(aviso.adjuntoArchivo)).catch(() => undefined);
  return prisma.avisoAutomatico.update({
    where: { id: avisoId },
    data: { adjuntoTipo: null, adjuntoArchivo: null, adjuntoMime: null, adjuntoNombre: null, adjuntoTexto: null, adjuntoUnaVez: false, ...sinPlantillaAdjunto() },
  });
}

export function sinPlantillaAdjunto() {
  return { adjuntoPlantillaNombre: null, adjuntoPlantillaId: null, adjuntoPlantillaEstado: null, adjuntoPlantillaMotivo: null };
}

/** El archivo para la dirección pública, por su token. */
export async function archivoPorToken(token: string) {
  const aviso = await prisma.avisoAutomatico.findUnique({
    where: { adjuntoToken: token },
    select: { adjuntoArchivo: true, adjuntoMime: true, deletedAt: true },
  });
  if (!aviso?.adjuntoArchivo || aviso.deletedAt) return null;
  const abs = rutaAbsoluta(aviso.adjuntoArchivo);
  const stat = await fsPromises.stat(abs).catch(() => null);
  if (!stat) return null;
  return { stream: fs.createReadStream(abs), mime: aviso.adjuntoMime ?? "application/octet-stream", size: stat.size };
}

/** Si el aviso tiene el video o la foto completos (archivo y texto). */
export function tieneAdjunto(a: { canal: string; adjuntoArchivo: string | null; adjuntoTexto: string | null }): boolean {
  return a.canal === "WHATSAPP" && !!a.adjuntoArchivo && !!a.adjuntoTexto?.trim();
}
