/**
 * Registro central del gasto de IA (tabla `ai_usage`).
 *
 * Toda llamada a Claude pasa por `createMessage()` y todo audio transcripto
 * por `recordWhisperUsage()`: así hay un solo lugar que sabe cuánto se gasta,
 * por función y por modelo. Antes solo el informe de visita y el Proyecto Final
 * guardaban su costo; el resto (minutas, lectura de cédulas y facturas,
 * mail de novedades, Whisper) gastaba sin dejar rastro.
 *
 * El registro es best-effort: si falla el insert se loguea y la función que
 * llamó a la IA sigue como si nada. Medir no puede romper lo que se mide.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../lib/prisma.js";
import { costoAnthropic, costoWhisper } from "./pricing.js";

/** Las funciones de Voltia PM que usan IA. Se guarda como texto: sumar una no pide migración. */
export const AI_FEATURES = {
  asistente: "Asistente de preguntas",
  efp: "Proyecto Final de Ingeniería",
  visita_informe: "Informe de visita técnica",
  visita_audio: "Transcripción de audios de visita",
  minuta: "Lectura de minutas",
  ute_extract: "Lectura de cédulas y facturas UTE",
  novedades_mail: "Mail de novedades",
  justificacion_potencia: "Justificación de potencia ante UTE",
} as const;

export type AIFeature = keyof typeof AI_FEATURES;

export type AIUsageCtx = {
  userId?: string | null;
  projectId?: string | null;
  entityId?: string | null;
};

function registrar(data: Parameters<typeof prisma.aIUsage.create>[0]["data"]): void {
  void prisma.aIUsage.create({ data }).catch((err) => {
    console.error("[ai/usage] No se pudo registrar el uso de IA:", err);
  });
}

/**
 * `client.messages.create` con registro de uso. Devuelve la respuesta sin
 * tocar y relanza el mismo error si la llamada falla (en ese caso la fila
 * queda con `ok=false` y tokens en 0: la API no informa uso de un error).
 *
 * Recibe el cliente del servicio en vez de crear uno propio: cada servicio
 * conserva su forma de avisar que falta la API key.
 */
export async function createMessage(
  client: Anthropic,
  feature: AIFeature,
  params: Anthropic.MessageCreateParamsNonStreaming,
  ctx: AIUsageCtx = {},
): Promise<Anthropic.Message> {
  const t0 = Date.now();
  try {
    const response = await client.messages.create(params);
    const u = response.usage;
    const uso = {
      input: u.input_tokens,
      output: u.output_tokens,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
    };
    registrar({
      feature,
      provider: "anthropic",
      model: params.model,
      tokensInput: uso.input,
      tokensOutput: uso.output,
      cacheRead: uso.cacheRead,
      cacheWrite: uso.cacheWrite,
      costUsd: costoAnthropic(params.model, uso),
      durationMs: Date.now() - t0,
      ok: true,
      userId: ctx.userId ?? null,
      projectId: ctx.projectId ?? null,
      entityId: ctx.entityId ?? null,
    });
    return response;
  } catch (err) {
    registrar({
      feature,
      provider: "anthropic",
      model: params.model,
      costUsd: 0,
      durationMs: Date.now() - t0,
      ok: false,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
      userId: ctx.userId ?? null,
      projectId: ctx.projectId ?? null,
      entityId: ctx.entityId ?? null,
    });
    throw err;
  }
}

export function recordWhisperUsage(args: {
  model: string;
  segundos: number | null | undefined;
  ok: boolean;
  durationMs: number;
  error?: string;
  ctx?: AIUsageCtx;
}): void {
  const segundos = args.segundos ?? 0;
  registrar({
    feature: "visita_audio" satisfies AIFeature,
    provider: "openai",
    model: args.model,
    audioSeconds: segundos,
    costUsd: args.ok ? costoWhisper(args.model, segundos) : 0,
    durationMs: args.durationMs,
    ok: args.ok,
    error: args.error?.slice(0, 500) ?? null,
    userId: args.ctx?.userId ?? null,
    projectId: args.ctx?.projectId ?? null,
    entityId: args.ctx?.entityId ?? null,
  });
}
