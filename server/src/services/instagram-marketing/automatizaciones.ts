/**
 * Automatizaciones de Instagram descritas en palabras (el "ManyChat con IA").
 *
 * Pedido de Nicolás del 29-oct-2026: en vez de un flujo de bloques, cada rutina
 * es una automatización con su flujo escrito en castellano. Claude sigue el
 * flujo; el servidor pone los límites que no pueden depender de él (ventanas de
 * Meta, topes, no repetir).
 *
 * Viven en la tabla `marketing_automatizaciones`. La primera vez se siembran
 * desde `server/config/instagram/*.md` (encabezado entre `+++` y el flujo
 * debajo); después se prenden, apagan y editan desde Marketing y la siembra no
 * pisa nada. Las que empiezan con "_" son textos comunes, no automatizaciones.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { MarketingAutomatizacion, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { asistenteConfig } from "./config.js";

export const DISPARADORES = ["comentario", "privado", "seguimiento", "texto"] as const;
export type Disparador = (typeof DISPARADORES)[number];

export type Automatizacion = {
  id: string;
  nombre: string;
  activa: boolean;
  disparador: Disparador;
  palabras: string[];
  publicaciones: string[];
  link: string;
  espera: [number, number];
  topeDiario: number;
  extra: Record<string, unknown>;
  flujo: string;
};

// ── Archivos ────────────────────────────────────────────────────────────────

export function carpetaArchivos(): string {
  // src/services/instagram-marketing → server/config/instagram
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "config", "instagram");
}

/**
 * El encabezado es TOML simple: `clave = valor` por línea, con valores que
 * también son JSON válido (texto entre comillas, números, true/false, listas).
 * Las líneas con # son comentarios.
 */
export function leerArchivo(nombreArchivo: string, texto: string) {
  const partes = texto.split("+++");
  if (partes.length < 3 || partes[0].trim()) {
    throw new Error(`${nombreArchivo}: falta el encabezado entre +++`);
  }
  const meta: Record<string, unknown> = {};
  for (const linea of partes[1].split("\n")) {
    const l = linea.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i < 0) throw new Error(`${nombreArchivo}: línea sin "=" en el encabezado: ${l}`);
    const clave = l.slice(0, i).trim();
    try {
      meta[clave] = JSON.parse(l.slice(i + 1).trim());
    } catch {
      throw new Error(`${nombreArchivo}: valor mal escrito en "${clave}"`);
    }
  }
  const disparador = meta.disparador as Disparador;
  if (!DISPARADORES.includes(disparador)) {
    throw new Error(`${nombreArchivo}: disparador tiene que ser ${DISPARADORES.join(", ")}`);
  }
  const espera = (meta.espera_seg as number[] | undefined) ?? [40, 150];
  const { nombre, activa, palabras, publicaciones, link, espera_seg, tope_diario, ...extra } = meta;
  void espera_seg;
  return {
    id: nombreArchivo.replace(/\.md$/, ""),
    nombre: String(nombre ?? nombreArchivo),
    activa: Boolean(activa),
    disparador,
    palabras: ((palabras as string[] | undefined) ?? []).map(normalizar).filter(Boolean),
    publicaciones: ((publicaciones as unknown[] | undefined) ?? []).map(String),
    link: (link as string | undefined) || null,
    esperaMinSeg: Math.round(Number(espera[0])),
    esperaMaxSeg: Math.round(Number(espera[espera.length - 1])),
    topeDiario: Number(tope_diario ?? 40),
    extra: extra as Prisma.InputJsonObject,
    flujo: partes.slice(2).join("+++").trim(),
  };
}

/** Crea las que falten desde los archivos. Nunca pisa lo que ya está en la base. */
export async function sembrarAutomatizaciones(): Promise<string[]> {
  const carpeta = carpetaArchivos();
  let archivos: string[];
  try {
    archivos = readdirSync(carpeta).filter((a) => a.endsWith(".md")).sort();
  } catch {
    return [];
  }
  const existentes = new Set((await prisma.marketingAutomatizacion.findMany({ select: { id: true } })).map((a) => a.id));
  const creadas: string[] = [];
  for (const archivo of archivos) {
    const datos = leerArchivo(archivo, readFileSync(join(carpeta, archivo), "utf8"));
    if (existentes.has(datos.id)) continue;
    await prisma.marketingAutomatizacion.create({ data: datos });
    creadas.push(datos.id);
  }
  return creadas;
}

// ── Lectura ─────────────────────────────────────────────────────────────────

export function desdeFila(a: MarketingAutomatizacion): Automatizacion {
  return {
    id: a.id,
    nombre: a.nombre,
    activa: a.activa,
    disparador: a.disparador as Disparador,
    palabras: a.palabras,
    publicaciones: a.publicaciones,
    link: a.link ?? "",
    espera: [a.esperaMinSeg, Math.max(a.esperaMinSeg, a.esperaMaxSeg)],
    topeDiario: a.topeDiario,
    extra: (a.extra ?? {}) as Record<string, unknown>,
    flujo: a.flujo,
  };
}

export async function todas(): Promise<Automatizacion[]> {
  const filas = await prisma.marketingAutomatizacion.findMany({ orderBy: { id: "asc" } });
  return filas.map(desdeFila);
}

export async function una(id: string): Promise<Automatizacion | null> {
  const a = await prisma.marketingAutomatizacion.findUnique({ where: { id } });
  return a ? desdeFila(a) : null;
}

export async function deTipo(disparador: Disparador): Promise<Automatizacion | null> {
  return (await todas()).find((a) => a.disparador === disparador) ?? null;
}

export async function textoComun(id: "_datos" | "_comentarios"): Promise<string> {
  return (await una(id))?.flujo ?? "";
}

// ── Palabras clave ──────────────────────────────────────────────────────────

export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** ¿Alguna palabra clave está en el texto? "ahorro" toma "Ahorro!", "ahorros", "AHORRO 🙌"; no "desahorro". */
export function coincide(palabras: string[], texto: string): boolean {
  const limpio = normalizar(texto);
  return palabras.some((p) => new RegExp(`(?<![a-z0-9])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(limpio));
}

function enPublicacion(a: Automatizacion, mediaId: string): boolean {
  return a.publicaciones.length === 0 || a.publicaciones.includes(mediaId);
}

/**
 * La automatización prendida que toma este comentario, o null: primero las de
 * palabra clave; si ninguna coincide, la general (sin palabras).
 */
export function elegirParaComentario(autos: Automatizacion[], texto: string, mediaId: string): Automatizacion | null {
  const activas = autos.filter((a) => a.activa && a.disparador === "comentario" && enPublicacion(a, mediaId));
  return (
    activas.find((a) => a.palabras.length > 0 && coincide(a.palabras, texto)) ??
    activas.find((a) => a.palabras.length === 0) ??
    null
  );
}

/** Reemplaza {DERIVAR_A} y {DERIVAR_WHATSAPP} por los de la configuración. */
export function completar(texto: string): string {
  const c = asistenteConfig();
  return texto.replaceAll("{DERIVAR_A}", c.derivarA).replaceAll("{DERIVAR_WHATSAPP}", c.derivarWhatsapp);
}
