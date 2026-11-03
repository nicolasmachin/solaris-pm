/**
 * Los archivos que manda la persona por Instagram (la factura de UTE, fotos del
 * techo): se bajan de Meta apenas llegan, porque el link que manda Meta vence.
 * Van adjuntos en el mail de derivación y se copian a los adjuntos del lead
 * cuando se crea desde la conversación. Pedido de Nicolás del 1-nov-2026.
 */

import { readFile } from "node:fs/promises";

import { FileAttachmentTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import type { EmailAttachment } from "../email.service.js";
import { getStoredFilePath, saveBufferAsAttachment } from "../file-storage.service.js";

export const MAXIMO_BYTES = 25 * 1024 * 1024;
/** Lo que entra en un mail sin que lo rebote el servidor. */
const MAXIMO_MAIL_BYTES = 18 * 1024 * 1024;
const ESPERA_MS = 30_000;

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/aac": ".aac",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

const PALABRA: Record<string, string> = { image: "foto", file: "archivo", video: "video", audio: "audio" };

/** El nombre con que se guarda y se manda: "foto-01-11-0907.jpg". Lógica pura. */
export function nombreArchivo(tipo: string, mimeType: string, momento: Date, orden = 0): string {
  const mime = mimeType.split(";")[0].trim().toLowerCase();
  const ext = EXTENSIONES[mime] ?? (mime === "application/octet-stream" && tipo === "image" ? ".jpg" : ".bin");
  const p = new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/Montevideo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(momento);
  const v = (t: string) => (p.find((x) => x.type === t)?.value ?? "").padStart(2, "0");
  const palabra = PALABRA[tipo] ?? (mime === "application/pdf" ? "archivo" : "adjunto");
  return `${palabra}-${v("day")}-${v("month")}-${v("hour")}${v("minute")}${orden ? `-${orden + 1}` : ""}${ext}`;
}

export type Bajar = (url: string) => Promise<{ datos: Buffer; mimeType: string }>;

export const bajarDeMeta: Bajar = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS) });
  if (!r.ok) throw new Error(`Meta respondió ${r.status}`);
  const largo = Number(r.headers.get("content-length") ?? 0);
  if (largo > MAXIMO_BYTES) throw new Error("archivo demasiado grande");
  const datos = Buffer.from(await r.arrayBuffer());
  if (datos.length > MAXIMO_BYTES) throw new Error("archivo demasiado grande");
  return { datos, mimeType: r.headers.get("content-type") ?? "application/octet-stream" };
};

/**
 * Baja y guarda los archivos de un mensaje. Lo que falla se anota en el log y
 * no frena nada: el mensaje ya quedó guardado con su "[Mandó: …]".
 */
export async function guardarArchivos(
  mensaje: { id: string; conversacionId: string; enviadoEn: Date },
  archivos: Array<{ tipo: string; url: string }>,
  bajar: Bajar = bajarDeMeta,
): Promise<number> {
  let guardados = 0;
  for (const [i, a] of archivos.entries()) {
    if (!a.url || !/^https:\/\//.test(a.url)) continue;
    try {
      const { datos, mimeType } = await bajar(a.url);
      const mime = mimeType.split(";")[0].trim().toLowerCase();
      const nombre = nombreArchivo(a.tipo, mime, mensaje.enviadoEn, archivos.length > 1 ? i : 0);
      const g = await saveBufferAsAttachment(datos, nombre, mime, `instagram/${mensaje.conversacionId}`);
      await prisma.instagramArchivo.create({
        data: { mensajeId: mensaje.id, tipo: a.tipo, nombre, mimeType: mime, sizeBytes: g.sizeBytes, url: g.url },
      });
      guardados += 1;
    } catch (err) {
      console.error(`[instagram] no se pudo bajar un ${a.tipo} de ${mensaje.conversacionId}:`, err instanceof Error ? err.message : err);
    }
  }
  return guardados;
}

/** Los archivos que mandó la persona en la conversación, del más viejo al más nuevo. */
export async function archivosDe(conversacionId: string) {
  return prisma.instagramArchivo.findMany({
    where: { mensaje: { conversacionId, autor: "CLIENTE" } },
    orderBy: { creadoEn: "asc" },
  });
}

/**
 * Para el mail: lo último que mandó, hasta lo que entra en un mail. Devuelve
 * también cuántos quedaron afuera (se ven en Voltia PM).
 */
export async function adjuntosParaMail(conversacionId: string): Promise<{ adjuntos: EmailAttachment[]; afuera: number }> {
  const todos = (await archivosDe(conversacionId)).reverse();
  const adjuntos: EmailAttachment[] = [];
  let total = 0;
  for (const a of todos) {
    if (total + a.sizeBytes > MAXIMO_MAIL_BYTES || adjuntos.length >= 10) continue;
    try {
      adjuntos.push({ filename: a.nombre, content: await readFile(getStoredFilePath(a.url)), contentType: a.mimeType });
      total += a.sizeBytes;
    } catch {
      // El archivo no está en el disco: se ve igual el resto.
    }
  }
  return { adjuntos: adjuntos.reverse(), afuera: todos.length - adjuntos.length };
}

/** Copia a los adjuntos del lead lo que mandó la persona (la factura, el techo). */
export async function copiarAlLead(conversacionId: string, leadId: string, usuarioId: string): Promise<number> {
  let copiados = 0;
  for (const a of await archivosDe(conversacionId)) {
    try {
      const datos = await readFile(getStoredFilePath(a.url));
      const g = await saveBufferAsAttachment(datos, `instagram-${a.nombre}`, a.mimeType, `leads/${leadId}`);
      await prisma.fileAttachment.create({
        data: {
          leadId,
          filename: g.filename,
          storedFilename: g.storedFilename,
          mimeType: a.mimeType,
          sizeBytes: g.sizeBytes,
          url: g.url,
          tipo: FileAttachmentTipo.UPLOAD_MANUAL,
          uploadedById: usuarioId,
        },
      });
      copiados += 1;
    } catch (err) {
      console.error(`[instagram] no se pudo copiar ${a.nombre} al lead ${leadId}:`, err instanceof Error ? err.message : err);
    }
  }
  return copiados;
}

export type ObtenerAdjuntos = (mid: string) => Promise<Array<{ tipo: string; url: string }>>;

/**
 * Recupera los archivos de los mensajes que dicen "[Mandó: foto/archivo…]" y no
 * tienen ninguno guardado: los que llegaron antes de que se bajaran (1-nov-2026)
 * o cuando falló la bajada. Le pide a Meta links nuevos por el id del mensaje.
 * Idempotente. Sin `aplicar`, solo cuenta lo que haría.
 */
export async function recuperarArchivos(opciones: {
  aplicar: boolean;
  obtener: ObtenerAdjuntos;
  bajar?: Bajar;
  log?: (linea: string) => void;
}) {
  const log = opciones.log ?? (() => {});
  const mensajes = await prisma.instagramMensaje.findMany({
    where: {
      archivos: { none: {} },
      OR: ["image", "file", "video", "audio"].map((t) => ({ texto: { contains: `[Mandó: ${t}]` } })),
    },
    orderBy: { enviadoEn: "asc" },
    include: { conversacion: { select: { usuario: true, persona: true } } },
  });
  const r = { revisados: 0, sinId: 0, metaSinDatos: 0, errores: 0, archivos: 0 };
  for (const m of mensajes) {
    r.revisados += 1;
    const quien = m.conversacion.usuario ? `@${m.conversacion.usuario}` : m.conversacion.persona;
    // Sin el id de Meta (llave armada por momento y texto) no hay a quién pedírselo.
    if (/^t\d+-/.test(m.clave)) {
      r.sinId += 1;
      continue;
    }
    try {
      const archivos = await opciones.obtener(m.clave);
      if (archivos.length === 0) {
        r.metaSinDatos += 1;
        log(`${quien} ${m.enviadoEn.toISOString()}: Meta no devolvió adjuntos`);
        continue;
      }
      if (!opciones.aplicar) {
        r.archivos += archivos.length;
        log(`${quien} ${m.enviadoEn.toISOString()}: ${archivos.length} para bajar`);
        continue;
      }
      const n = await guardarArchivos(m, archivos, opciones.bajar);
      r.archivos += n;
      log(`${quien} ${m.enviadoEn.toISOString()}: ${n} de ${archivos.length} guardados`);
    } catch (err) {
      r.errores += 1;
      log(`${quien} ${m.enviadoEn.toISOString()}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return r;
}
