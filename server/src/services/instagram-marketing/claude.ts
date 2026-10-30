/**
 * La llamada a Claude del asistente de Instagram: salida JSON con esquema,
 * esfuerzo bajo, instrucciones fijas con caché y lo propio de cada caso aparte
 * (para no romper el caché). El gasto queda en `ai_usage` (createMessage).
 */

import Anthropic from "@anthropic-ai/sdk";

import { costoAnthropic } from "../ai/pricing.js";
import { type AIFeature, createMessage } from "../ai/usage.js";
import { asistenteConfig } from "./config.js";

let cliente: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY.");
  cliente ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 40_000, maxRetries: 2 });
  return cliente;
}

export type RespuestaClaude<T> = { resultado: T | null; problema: string | null; costoUsd: number };

export async function pedirJson<T>(args: {
  feature: AIFeature;
  instrucciones: string;
  contexto?: string;
  mensajes: Anthropic.MessageParam[];
  esquema: Record<string, unknown>;
  maxTokens: number;
  entityId?: string;
}): Promise<RespuestaClaude<T>> {
  const modelo = asistenteConfig().modelo;
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: args.instrucciones, cache_control: { type: "ephemeral" } },
  ];
  if (args.contexto) system.push({ type: "text", text: args.contexto });
  const r = await createMessage(
    anthropic(),
    args.feature,
    {
      model: modelo,
      max_tokens: args.maxTokens,
      system,
      messages: args.mensajes,
      output_config: { effort: "low", format: { type: "json_schema", schema: args.esquema } },
    },
    { entityId: args.entityId ?? null },
  );
  const costoUsd =
    costoAnthropic(modelo, {
      input: r.usage.input_tokens,
      output: r.usage.output_tokens,
      cacheRead: r.usage.cache_read_input_tokens ?? 0,
      cacheWrite: r.usage.cache_creation_input_tokens ?? 0,
    }) ?? 0;
  if (r.stop_reason === "refusal") return { resultado: null, problema: "Claude no quiso contestar", costoUsd };
  if (r.stop_reason === "max_tokens") return { resultado: null, problema: "la respuesta salió cortada", costoUsd };
  const texto = r.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  try {
    return { resultado: JSON.parse(texto) as T, problema: null, costoUsd };
  } catch {
    return { resultado: null, problema: "respuesta ilegible de Claude", costoUsd };
  }
}
