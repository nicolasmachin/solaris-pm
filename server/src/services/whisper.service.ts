// Servicio de transcripción de audios con OpenAI Whisper. Se usa en el
// pipeline de Visita Técnica: el operario graba un audio, el servidor lo
// guarda como FileAttachment + VisitInput (status PENDING), y dispara este
// servicio en background. Cuando termina, actualiza el VisitInput con el
// texto y status COMPLETED (o FAILED si algo rompió).

import fs from "node:fs";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL = process.env.WHISPER_MODEL ?? "whisper-1";

let openaiClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no configurada — no se puede transcribir");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return openaiClient;
}

export function isWhisperEnabled(): boolean {
  return !!OPENAI_API_KEY;
}

export interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
  modelUsed: string;
}

/**
 * Transcribe un archivo de audio del disco. Devuelve el texto + metadata.
 * Lanza si OPENAI_API_KEY no está configurada o el archivo no es legible.
 */
export async function transcribeAudio(absolutePath: string): Promise<TranscriptionResult> {
  if (!isWhisperEnabled()) {
    throw new Error("Whisper deshabilitado (OPENAI_API_KEY faltante)");
  }
  const client = getClient();
  const stream = fs.createReadStream(absolutePath);
  const result = await client.audio.transcriptions.create({
    file: stream,
    model: DEFAULT_MODEL,
    language: "es",
    response_format: "verbose_json",
  });

  // verbose_json devuelve { text, language, duration, segments, ... }
  const r = result as unknown as { text: string; duration?: number; language?: string };
  return {
    text: r.text,
    duration: r.duration,
    language: r.language,
    modelUsed: DEFAULT_MODEL,
  };
}
