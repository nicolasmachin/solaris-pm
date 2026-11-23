/**
 * Archivos de WhatsApp (fotos, audios, videos, documentos, stickers): se bajan
 * de Meta al llegar el mensaje (entrante, eco del celular o historial) y se
 * guardan en el storage, en whatsapp/<phoneNumberId>/<id del mensaje>.<ext>.
 * Los que no se bajaron al llegar (los anteriores a esto, o si Meta falló) se
 * bajan la primera vez que alguien los abre: Meta los guarda unos 30 días.
 *
 * Ver docs/manual/15-whatsapp.md.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { prisma } from "../../lib/prisma.js";
import { getStoredFilePath } from "../file-storage.service.js";
import { decryptSecret } from "../email/crypto.js";
import { isWhisperEnabled, transcribeAudio } from "../whisper.service.js";
import { comprimirFoto, comprimirVideo } from "./compresion.service.js";
import { graphUrl, whatsappConfig } from "./config.js";

/** Marca de un archivo borrado en la limpieza: no se vuelve a pedir a Meta. */
export const BORRADO_EN_LIMPIEZA = "Borrado en la limpieza de archivos viejos";

export const TIPOS_CON_ARCHIVO = ["image", "audio", "voice", "video", "document", "sticker"] as const;

type MediaMeta = { id?: string; mime_type?: string; filename?: string; caption?: string };

/** El bloque del archivo dentro del mensaje de Meta (`payload.image`, `payload.audio`…). */
export function mediaDe(tipo: string, payload: unknown): MediaMeta | null {
  if (!(TIPOS_CON_ARCHIVO as readonly string[]).includes(tipo)) return null;
  const bloque = (payload as Record<string, unknown> | null)?.[tipo] as MediaMeta | undefined;
  return bloque?.id ? bloque : null;
}

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

function extensionDe(mime: string, nombre?: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (EXTENSIONES[base]) return EXTENSIONES[base];
  const deNombre = nombre?.match(/\.([a-z0-9]{1,6})$/i)?.[1];
  return deNombre?.toLowerCase() ?? "bin";
}

/** El token con el que se pide el archivo: el del número conectado o, si no, el del servidor. */
async function tokenDe(phoneNumberId: string): Promise<string> {
  const n = await prisma.whatsAppNumero.findUnique({ where: { phoneNumberId }, select: { tokenCifrado: true } });
  return n ? decryptSecret(n.tokenCifrado) : whatsappConfig().token;
}

/** Baja el archivo de un mensaje (si no está bajado) y devuelve dónde quedó. */
export async function bajarArchivo(mensajeId: string): Promise<{ archivoPath: string; archivoMime: string }> {
  const m = await prisma.whatsAppMensaje.findUniqueOrThrow({
    where: { id: mensajeId },
    select: { id: true, tipo: true, payload: true, phoneNumberId: true, archivoPath: true, archivoMime: true },
  });
  if (m.archivoPath && m.archivoMime) return { archivoPath: m.archivoPath, archivoMime: m.archivoMime };
  const marca = await prisma.whatsAppMensaje.findUnique({ where: { id: m.id }, select: { archivoError: true } });
  if (marca?.archivoError === BORRADO_EN_LIMPIEZA) throw new Error(BORRADO_EN_LIMPIEZA);
  const media = mediaDe(m.tipo, m.payload);
  if (!media?.id) throw new Error("El mensaje no tiene archivo");

  try {
    const token = await tokenDe(m.phoneNumberId);
    const auth = { Authorization: `Bearer ${token}` };
    const info = await fetch(graphUrl(media.id), { headers: auth });
    const datos = (await info.json().catch(() => ({}))) as { url?: string; mime_type?: string; error?: { message?: string } };
    if (!info.ok || !datos.url) throw new Error(datos.error?.message ?? `Meta respondió ${info.status}`);
    const archivo = await fetch(datos.url, { headers: auth });
    if (!archivo.ok) throw new Error(`No se pudo bajar el archivo (${archivo.status})`);
    let bytes: Buffer = Buffer.from(await archivo.arrayBuffer());

    let mime = (datos.mime_type ?? media.mime_type ?? archivo.headers.get("content-type") ?? "application/octet-stream").split(";")[0];
    // Las fotos se achican al guardarlas (los videos, de fondo: tardan).
    if (m.tipo === "image") {
      const c = await comprimirFoto({ bytes, mime, nombre: media.filename ?? "foto" });
      bytes = c.bytes;
      mime = c.mime;
    }
    const relativo = path.posix.join("whatsapp", m.phoneNumberId, `${m.id}.${extensionDe(mime, media.filename)}`);
    const absoluto = getStoredFilePath(relativo);
    await fs.mkdir(path.dirname(absoluto), { recursive: true });
    await fs.writeFile(absoluto, bytes);
    await prisma.whatsAppMensaje.update({ where: { id: m.id }, data: { archivoPath: relativo, archivoMime: mime, archivoError: null } });
    if (m.tipo === "audio" || m.tipo === "voice") void transcribir(m.id, absoluto);
    if (m.tipo === "video") void achicarVideo(m.id, absoluto, mime);
    return { archivoPath: relativo, archivoMime: mime };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.whatsAppMensaje.update({ where: { id: m.id }, data: { archivoError: msg.slice(0, 500) } });
    throw err;
  }
}

/** Para el webhook: baja sin frenar la respuesta a Meta ni romper si falla. */
export function bajarArchivoDeFondo(mensajeId: string) {
  bajarArchivo(mensajeId).catch((err) =>
    console.error("[whatsapp] no se pudo bajar el archivo del mensaje", mensajeId, err instanceof Error ? err.message : err),
  );
}

/** Transcribe un audio ya bajado (Whisper). Si falla, el audio se escucha igual. */
async function transcribir(mensajeId: string, absoluto: string) {
  if (!isWhisperEnabled()) return;
  try {
    const r = await transcribeAudio(absoluto, { entityId: mensajeId }, "whatsapp_audio");
    const m = await prisma.whatsAppMensaje.update({ where: { id: mensajeId }, data: { transcripcion: r.text.trim() || null } });
    // Lo que dice el audio entra a la conversación del día en la ficha.
    if (m.origen !== "HISTORIAL") {
      const { registrarConversacionDelDia } = await import("./bandejas.service.js");
      await registrarConversacionDelDia(m.phoneNumberId, m.telefono, m.ocurridoEn);
    }
  } catch (err) {
    console.error("[whatsapp] no se pudo transcribir el audio", mensajeId, err instanceof Error ? err.message : err);
  }
}

/** Reemplaza el video guardado por uno de 720p (de fondo, porque tarda). */
async function achicarVideo(mensajeId: string, absoluto: string, mime: string) {
  try {
    const original = await fs.readFile(absoluto);
    const c = await comprimirVideo({ bytes: original, mime, nombre: path.basename(absoluto) });
    if (c.bytes === original) return;
    const nuevo = absoluto.replace(/\.[^.]+$/, ".mp4");
    await fs.writeFile(nuevo, c.bytes);
    if (nuevo !== absoluto) await fs.rm(absoluto, { force: true });
    const m = await prisma.whatsAppMensaje.findUniqueOrThrow({ where: { id: mensajeId }, select: { archivoPath: true } });
    await prisma.whatsAppMensaje.update({
      where: { id: mensajeId },
      data: { archivoPath: m.archivoPath!.replace(/\.[^.]+$/, ".mp4"), archivoMime: "video/mp4" },
    });
  } catch (err) {
    console.error("[whatsapp] no se pudo achicar el video", mensajeId, err instanceof Error ? err.message : err);
  }
}
