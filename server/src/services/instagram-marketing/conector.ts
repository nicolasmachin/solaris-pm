/**
 * Lo que Voltia PM le pide al conector de indicadores: mandar un mensaje y tomar
 * o devolver una conversación. El token de Meta y el contestador viven allá; por
 * eso las respuestas a mano salen por el conector y no directo a Meta: así el
 * asistente se entera y no contesta encima.
 */

import { AppError } from "../../utils/errors.js";
import { instagramConectorConfig } from "./config.js";

type Por = { id: string; nombre: string };

async function pedir<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const { url, secreto } = instagramConectorConfig();
  if (!url || !secreto) {
    throw new AppError(
      503,
      "CONECTOR_NO_CONFIGURADO",
      "Falta conectar Voltia PM con el contestador de Instagram (INSTAGRAM_CONECTOR_URL y INSTAGRAM_CONECTOR_SECRETO).",
    );
  }
  let res: Response;
  try {
    res = await fetch(`${url}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secreto}` },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error(`[instagram] el conector no contestó (${ruta}):`, err instanceof Error ? err.message : err);
    throw new AppError(502, "CONECTOR_SIN_RESPUESTA", "El contestador de Instagram no responde. Probá de nuevo en un rato.");
  }
  const datos = (await res.json().catch(() => ({}))) as { mensaje?: string; error?: string } & T;
  if (!res.ok) {
    const mensaje = datos.mensaje ?? datos.error ?? `El contestador de Instagram respondió ${res.status}`;
    throw new AppError(res.status === 409 ? 409 : 502, "CONECTOR_ERROR", mensaje);
  }
  return datos;
}

/** Manda un mensaje de una persona de Voltia. Devuelve el id del mensaje en Meta. */
export async function enviarPorConector(persona: string, texto: string, por: Por): Promise<{ mid: string }> {
  const r = await pedir<{ mid?: string }>("/api/privados/enviar", { persona, texto, por });
  if (!r.mid) throw new AppError(502, "CONECTOR_ERROR", "El contestador de Instagram no devolvió el id del mensaje");
  return { mid: r.mid };
}

/** Tomar (el asistente se calla) o devolver la conversación al asistente. */
export async function tomarPorConector(persona: string, tomada: boolean, por: Por): Promise<void> {
  await pedir("/api/privados/tomar", { persona, tomada, por });
}
