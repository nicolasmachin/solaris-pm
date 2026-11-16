/**
 * Achica fotos y videos de WhatsApp antes de guardarlos o mandarlos: la calidad
 * de una foto de WhatsApp alcanza para trabajar y el storage no se llena. Las
 * fotos pasan a JPG de hasta 1600 px; los videos, a MP4 H.264 de 720p con el
 * mismo perfil que los videos de obra. Audios y documentos quedan como están.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import sharp from "sharp";

import { env } from "../../config/env.js";

import { probeVideo, transcodeToStandard } from "../video-transcode.service.js";

export type Archivo = { bytes: Buffer; mime: string; nombre: string };

/** Límites de WhatsApp para mandar (en bytes). */
export const LIMITE_ENVIO: Record<"image" | "audio" | "video" | "document", number> = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

function conExtension(nombre: string, ext: string) {
  return `${nombre.replace(/\.[^.]+$/, "") || "archivo"}.${ext}`;
}

export async function comprimirFoto(a: Archivo): Promise<Archivo> {
  try {
    const bytes = await sharp(a.bytes).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    // Si ya era más chica (un sticker, una captura liviana), queda la original.
    return bytes.length < a.bytes.length ? { bytes, mime: "image/jpeg", nombre: conExtension(a.nombre, "jpg") } : a;
  } catch {
    return a;
  }
}

export async function comprimirVideo(a: Archivo): Promise<Archivo> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "wa-video-"));
  const entrada = path.join(dir, `${randomUUID()}.in`);
  const salida = path.join(dir, `${randomUUID()}.mp4`);
  try {
    await fs.writeFile(entrada, a.bytes);
    await transcodeToStandard(entrada, salida, await probeVideo(entrada));
    const bytes = await fs.readFile(salida);
    return bytes.length < a.bytes.length ? { bytes, mime: "video/mp4", nombre: conExtension(a.nombre, "mp4") } : a;
  } catch (err) {
    console.error("[whatsapp] no se pudo comprimir el video:", err instanceof Error ? err.message : err);
    return a;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Un audio grabado en el navegador (webm, mp4) a nota de voz de WhatsApp: OGG con
 * Opus, que es lo único que WhatsApp muestra como nota de voz.
 */
export async function aNotaDeVoz(a: Archivo): Promise<Archivo> {
  if (a.mime.startsWith("audio/ogg")) return { ...a, mime: "audio/ogg" };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "wa-audio-"));
  const entrada = path.join(dir, "in");
  const salida = path.join(dir, "nota.ogg");
  try {
    await fs.writeFile(entrada, a.bytes);
    await promisify(execFile)(env.ffmpegPath, ["-y", "-i", entrada, "-vn", "-c:a", "libopus", "-b:a", "32k", "-ac", "1", salida], { timeout: 120_000 });
    return { bytes: await fs.readFile(salida), mime: "audio/ogg", nombre: conExtension(a.nombre, "ogg") };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Qué tipo de mensaje de WhatsApp es un archivo, por su mime. */
export function tipoDeArchivo(mime: string): "image" | "audio" | "video" | "document" {
  if (mime.startsWith("image/") && !mime.includes("svg")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/** Achica según el tipo. */
export async function comprimir(a: Archivo): Promise<Archivo> {
  const tipo = tipoDeArchivo(a.mime);
  if (tipo === "image") return comprimirFoto(a);
  if (tipo === "video") return comprimirVideo(a);
  return a;
}
