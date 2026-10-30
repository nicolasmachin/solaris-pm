/**
 * Lógica pura de la bandeja de Instagram: cómo se lee la conversación que manda
 * el conector y en qué estado está. Sin base, para poder probarla
 * (instagram-marketing.test.ts).
 */

import { createHash } from "node:crypto";

import { z } from "zod";

/** Ventana de Meta para contestar: 24 h desde el último mensaje del cliente, 7 días si vino de un anuncio. */
export const VENTANA_MS = 24 * 3600 * 1000;
export const VENTANA_ANUNCIO_MS = 7 * 24 * 3600 * 1000;
/** Una conversación derivada queda en manos de una persona 7 días (igual que en el conector). */
export const PAUSA_DERIVADA_MS = 7 * 24 * 3600 * 1000;

export type Autor = "CLIENTE" | "ASISTENTE" | "PERSONA" | "OTRO";

const AUTOR: Record<string, Autor> = {
  cliente: "CLIENTE",
  asistente: "ASISTENTE",
  persona: "PERSONA",
  otro: "OTRO",
};

const momento = z.number().nonnegative();

/** La conversación tal como la guarda el conector (datos/instagram/conversaciones/<id>.json). */
export const conversacionConectorSchema = z.object({
  persona: z.string().regex(/^\d+$/, "id de Instagram inválido"),
  usuario: z.string().nullish(),
  nombre: z.string().nullish(),
  desde_anuncio: z.boolean().nullish(),
  derivada: z.object({ momento, motivo: z.string().nullish() }).passthrough().nullish(),
  mensajes: z
    .array(
      z
        .object({
          mid: z.string().nullish(),
          /** Segundos desde 1970. */
          momento,
          de: z.string(),
          texto: z.string().nullish(),
          /** Id del usuario de Voltia PM que lo mandó (solo los de "persona"). */
          por: z.string().nullish(),
        })
        .passthrough(),
    )
    .default([]),
}).passthrough();

export type ConversacionConector = z.infer<typeof conversacionConectorSchema>;

/** Lo que manda el conector: una conversación, o varias juntas (la carga inicial). */
export const envioConectorSchema = z.object({
  conversacion: conversacionConectorSchema.optional(),
  conversaciones: z.array(conversacionConectorSchema).optional(),
  /** Carga del historial: lo que llega se da por leído. */
  historial: z.boolean().optional(),
});

export type MensajeNormalizado = {
  clave: string;
  autor: Autor;
  texto: string;
  enviadoEn: Date;
  enviadoPorId: string | null;
};

/**
 * La llave de un mensaje: el id de Meta. Algunos mensajes del conector no lo
 * tienen; para esos se arma una con el momento, el autor y el texto, que es
 * estable entre un envío y el siguiente.
 */
export function claveDe(m: { mid?: string | null; momento: number; de: string; texto?: string | null }): string {
  if (m.mid) return m.mid;
  const hash = createHash("sha1").update(m.texto ?? "").digest("hex").slice(0, 12);
  return `t${Math.round(m.momento)}-${m.de}-${hash}`;
}

export function normalizarMensajes(conv: ConversacionConector): MensajeNormalizado[] {
  const vistos = new Set<string>();
  const salida: MensajeNormalizado[] = [];
  for (const m of conv.mensajes) {
    const clave = claveDe(m);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const autor = AUTOR[m.de] ?? "OTRO";
    salida.push({
      clave,
      autor,
      texto: (m.texto ?? "").trim(),
      enviadoEn: new Date(m.momento * 1000),
      enviadoPorId: autor === "PERSONA" ? (m.por ?? null) : null,
    });
  }
  return salida.sort((a, b) => a.enviadoEn.getTime() - b.enviadoEn.getTime());
}

export type EstadoAsistente = "TOMADA" | "DERIVADA" | "ASISTENTE";

/** Quién atiende la conversación ahora. */
export function estadoAsistente(
  c: { tomadaEn: Date | null; derivadaEn: Date | null },
  ahora: Date = new Date(),
): EstadoAsistente {
  if (c.tomadaEn) return "TOMADA";
  if (c.derivadaEn && ahora.getTime() - c.derivadaEn.getTime() < PAUSA_DERIVADA_MS) return "DERIVADA";
  return "ASISTENTE";
}

/** Hasta cuándo se le puede escribir (la ventana de Meta), o null si nunca escribió. */
export function ventanaHasta(c: { ultimoClienteEn: Date | null; desdeAnuncio: boolean }): Date | null {
  if (!c.ultimoClienteEn) return null;
  return new Date(c.ultimoClienteEn.getTime() + (c.desdeAnuncio ? VENTANA_ANUNCIO_MS : VENTANA_MS));
}

export function ventanaAbierta(
  c: { ultimoClienteEn: Date | null; desdeAnuncio: boolean },
  ahora: Date = new Date(),
): boolean {
  const hasta = ventanaHasta(c);
  return !!hasta && hasta.getTime() > ahora.getTime();
}
