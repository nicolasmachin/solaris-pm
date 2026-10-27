// Lectura en voz alta de las respuestas del asistente, con la voz de OpenAI.
//
// La voz del navegador sonaba robótica y lenta; esta suena natural. El panel
// manda la respuesta de a pedazos (el primero corto) para que empiece a sonar
// enseguida y el resto se genere mientras tanto.

import OpenAI from "openai";

import { badRequest } from "../../utils/errors.js";
import { recordVozUsage, type AIUsageCtx } from "../ai/usage.js";

const MODELO = "gpt-4o-mini-tts";
const VOZ = "coral";
/** Tope de un pedazo: el modelo acepta ~2000 tokens de entrada. */
export const MAX_CARACTERES_VOZ = 4000;

const INDICACIONES =
  "Hablás en español rioplatense de Uruguay, con voseo. Tono natural y cordial de compañero de trabajo, " +
  "ritmo ágil de conversación, sin pausas largas. Los números y montos se leen como se dicen en Uruguay.";

let cliente: OpenAI | null = null;

export function vozHabilitada() {
  return !!process.env.OPENAI_API_KEY;
}

export async function textoAVoz(texto: string, ctx: AIUsageCtx): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw badRequest("SIN_VOZ", "La lectura en voz alta no está configurada");
  cliente ??= new OpenAI({ apiKey });
  const t0 = Date.now();
  try {
    const r = await cliente.audio.speech.create({
      model: MODELO,
      voice: VOZ,
      input: texto,
      instructions: INDICACIONES,
      response_format: "mp3",
    });
    const audio = Buffer.from(await r.arrayBuffer());
    recordVozUsage({ model: MODELO, feature: "asistente_voz", caracteres: texto.length, ok: true, durationMs: Date.now() - t0, ctx });
    return audio;
  } catch (err) {
    recordVozUsage({
      model: MODELO,
      feature: "asistente_voz",
      caracteres: texto.length,
      ok: false,
      durationMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
      ctx,
    });
    throw err;
  }
}
