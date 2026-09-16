// Integración con Bunny Stream para el módulo Capacitación.
//
// - Listar videos y colecciones de la biblioteca (API con `AccessKey`, alcanza la
//   key de solo lectura). La key nunca sale del server.
// - Firmar la URL del embed cuando la biblioteca tiene "Embed view token
//   authentication": token = sha256_hex(tokenKey + videoId + expires).
// - Bajar la miniatura de un video. No se linkea el CDN desde el navegador: la
//   sirve la app (ver services/capacitacion/miniaturas.service.ts).

import { createHash } from "node:crypto";

import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const API_BASE = "https://video.bunnycdn.com";
const EMBED_BASE = "https://iframe.mediadelivery.net/embed";
// Duración de la firma del embed. Alcanza para ver un video largo de corrido;
// al cambiar de video o recargar se pide una nueva.
const EMBED_TTL_SECONDS = 4 * 60 * 60;
// status 4 = "Finished" (procesado y reproducible).
export const BUNNY_STATUS_FINISHED = 4;

export type BunnyVideo = {
  guid: string;
  title: string;
  description: string | null;
  length: number;
  status: number;
  encodeProgress: number;
  thumbnailFileName: string | null;
  collectionId: string;
  dateUploaded: string;
};

export type BunnyCollection = {
  guid: string;
  name: string;
  videoCount: number;
};

type BunnyPage<T> = {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  items: T[];
};

export function bunnyConfigurado() {
  return Boolean(env.bunnyStreamLibraryId && env.bunnyStreamApiKey);
}

export function bunnyLibraryId() {
  return env.bunnyStreamLibraryId;
}

function assertConfigurado() {
  if (!bunnyConfigurado()) {
    throw new AppError(
      503,
      "BUNNY_NO_CONFIGURADO",
      "La conexión con Bunny no está configurada (faltan BUNNY_STREAM_LIBRARY_ID / BUNNY_STREAM_API_KEY)",
    );
  }
}

async function bunnyGet<T>(pathAndQuery: string): Promise<T> {
  assertConfigurado();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/library/${env.bunnyStreamLibraryId}${pathAndQuery}`, {
      headers: { AccessKey: env.bunnyStreamApiKey, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("Bunny: error de red", error);
    throw new AppError(502, "BUNNY_ERROR", "No se pudo conectar con Bunny");
  }
  if (response.status === 401 || response.status === 403) {
    throw new AppError(502, "BUNNY_CREDENCIALES", "Bunny rechazó la API key configurada");
  }
  if (response.status === 404) {
    throw new AppError(404, "BUNNY_NO_ENCONTRADO", "Bunny no encontró el recurso pedido");
  }
  if (!response.ok) {
    throw new AppError(502, "BUNNY_ERROR", `Bunny respondió ${response.status}`);
  }
  return (await response.json()) as T;
}

function mapVideo(raw: BunnyVideo): BunnyVideo {
  return {
    guid: raw.guid,
    title: raw.title,
    description: raw.description ?? null,
    length: raw.length ?? 0,
    status: raw.status,
    encodeProgress: raw.encodeProgress ?? 0,
    thumbnailFileName: raw.thumbnailFileName || null,
    collectionId: raw.collectionId ?? "",
    dateUploaded: raw.dateUploaded,
  };
}

export async function listarVideos(input: {
  page?: number;
  itemsPerPage?: number;
  search?: string;
  collectionId?: string;
}) {
  const params = new URLSearchParams({
    page: String(input.page ?? 1),
    itemsPerPage: String(input.itemsPerPage ?? 48),
    orderBy: "date",
  });
  if (input.search) params.set("search", input.search);
  if (input.collectionId) params.set("collection", input.collectionId);
  const data = await bunnyGet<BunnyPage<BunnyVideo>>(`/videos?${params.toString()}`);
  return { ...data, items: data.items.map(mapVideo) };
}

/** Trae todas las páginas (para importar una colección entera). */
export async function listarTodosLosVideos(collectionId?: string) {
  const todos: BunnyVideo[] = [];
  for (let page = 1; page <= 50; page++) {
    const data = await listarVideos({ page, itemsPerPage: 100, collectionId });
    todos.push(...data.items);
    if (todos.length >= data.totalItems || data.items.length === 0) break;
  }
  return todos;
}

export async function obtenerVideo(videoId: string) {
  return mapVideo(await bunnyGet<BunnyVideo>(`/videos/${encodeURIComponent(videoId)}`));
}

export async function listarColecciones() {
  const data = await bunnyGet<BunnyPage<BunnyCollection>>(
    "/collections?page=1&itemsPerPage=100&orderBy=date",
  );
  return data.items.map((c) => ({ guid: c.guid, name: c.name, videoCount: c.videoCount }));
}

/** Token del embed: sha256 hex de (tokenKey + videoId + expires). Exportado para test. */
export function calcularTokenEmbed(tokenKey: string, videoId: string, expires: number) {
  return createHash("sha256").update(`${tokenKey}${videoId}${expires}`).digest("hex");
}

export function firmarEmbed(libraryId: string, videoId: string, now = Date.now()) {
  const params = new URLSearchParams({ autoplay: "true", preload: "true", responsive: "true" });
  let expiresAt: Date | null = null;
  if (env.bunnyStreamTokenKey) {
    const expires = Math.floor(now / 1000) + EMBED_TTL_SECONDS;
    params.set("token", calcularTokenEmbed(env.bunnyStreamTokenKey, videoId, expires));
    params.set("expires", String(expires));
    expiresAt = new Date(expires * 1000);
  }
  return {
    embedUrl: `${EMBED_BASE}/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}?${params.toString()}`,
    expiresAt: expiresAt?.toISOString() ?? null,
  };
}

/**
 * Baja la miniatura de un video desde el CDN de Bunny. Manda Referer porque la
 * biblioteca tiene "Block direct url file access" (sin referer responde 403).
 * Devuelve null si Bunny ya no la tiene.
 */
export async function descargarMiniatura(videoId: string, filename: string) {
  const url = urlMiniatura(videoId, filename);
  if (!url) return null;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Referer: env.bunnyStreamReferer, accept: "image/*" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("Bunny: no se pudo bajar la miniatura", { videoId, error });
    return null;
  }
  if (!response.ok) {
    console.error("Bunny: miniatura no disponible", { videoId, status: response.status });
    return null;
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "image/jpeg",
  };
}

export function urlMiniatura(videoId: string, thumbnailFileName: string | null | undefined) {
  if (!env.bunnyStreamCdnHostname || !thumbnailFileName) return null;
  return `https://${env.bunnyStreamCdnHostname}/${videoId}/${thumbnailFileName}`;
}
