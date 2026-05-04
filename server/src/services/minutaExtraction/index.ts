// Servicio de extracción de campos del formulario Pre-Ingeniería a partir
// de la minuta del relevamiento técnico-comercial. Pipeline:
//   1. PDF buffer → texto plano (pdf-parse, sin imágenes)
//   2. Texto + system prompt → Claude API (Haiku 4.5 default)
//   3. JSON crudo → validación Zod estricta → ExtractedFields tipado
//
// La auditoría (latency, tokens, modelo, errores) la registra el endpoint
// que invoca a este servicio.

import Anthropic from "@anthropic-ai/sdk";
import { PDFParse } from "pdf-parse";
import { z } from "zod";

import { AppError, badRequest } from "../../utils/errors.js";

function internalError(code: string, message: string) {
  return new AppError(500, code, message);
}

function unprocessable(code: string, message: string) {
  return new AppError(422, code, message);
}

// ─── Defaults / config ──────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_MODEL = process.env.MINUTA_EXTRACTION_MODEL ?? "claude-haiku-4-5-20251001";
const MAX_OUTPUT_TOKENS = 2000;

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!ANTHROPIC_API_KEY) {
    throw internalError("ANTHROPIC_NOT_CONFIGURED", "ANTHROPIC_API_KEY no está configurada");
  }
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return anthropicClient;
}

export function isMinutaExtractionEnabled(): boolean {
  return !!ANTHROPIC_API_KEY;
}

// ─── Tipo de resultado ──────────────────────────────────────────────────────

export const ExtractedFieldsSchema = z.object({
  tipoTecho: z.enum(["ISOPANEL", "HORMIGON", "CHAPA", "TEJAS", "OTRO"]).nullable(),
  tipoTechoOtro: z.string().max(200).nullable(),
  infoTecho: z.string().max(2000).nullable(),
  alturaTecho: z.string().max(50).nullable(),
  cantidadPaneles: z.string().max(100).nullable(),
  potenciaPaneles: z.string().max(50).nullable(),
  inversor: z.string().max(150).nullable(),
  stringsLineasDc: z.string().max(50).nullable(),
  cableAc: z.string().max(100).nullable(),
  termicaAc: z.string().max(50).nullable(),
  diferencialAc: z.string().max(50).nullable(),
  largoCablesAcMts: z.string().max(20).nullable(),
  largoCablesDcMts: z.string().max(20).nullable(),
  redMonofasica: z.boolean(),
  redTrifasica230SN: z.boolean(),
  redTrifasica400CN: z.boolean(),
  notasAdicionales: z.string().max(2000).nullable(),
});

export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;

export interface ExtractMetadata {
  modelUsed: string;
  latencyMs: number;
  tokensInput: number;
  tokensOutput: number;
}

export interface ExtractResult {
  extractedFields: ExtractedFields;
  metadata: ExtractMetadata;
  /** Texto extraído del PDF (para debugging y posible cache) */
  pdfText: string;
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/** Extrae el texto plano de un PDF. Falla si el PDF no tiene texto extraíble
 * (p.ej. escaneado puro sin OCR). */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").trim();
    if (text.length < 100) {
      throw unprocessable(
        "PDF_NO_TEXT",
        "El PDF no contiene texto extraíble — probablemente es un escaneado sin OCR.",
      );
    }
    return text;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/** Llama a Claude con el system prompt + texto de la minuta y devuelve JSON
 * tipado + métricas de uso. */
export async function callClaudeForExtraction(
  minutaText: string,
  modelOverride?: string,
): Promise<{ fields: ExtractedFields; metadata: ExtractMetadata }> {
  const client = getAnthropic();
  const model = modelOverride ?? DEFAULT_MODEL;

  const t0 = Date.now();
  const response = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: USER_PROMPT_PREFIX + minutaText,
      },
    ],
  });
  const latencyMs = Date.now() - t0;

  // Extraer el texto JSON de la respuesta
  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw internalError("CLAUDE_NO_TEXT", "Respuesta de Claude sin bloque de texto");
  }
  const raw = textBlock.text.trim();

  // El modelo puede haber agregado markdown code fences. Lo limpio.
  const jsonText = stripCodeFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw internalError(
      "CLAUDE_INVALID_JSON",
      "Claude devolvió un JSON inválido. Reintentar.",
    );
  }

  const validated = ExtractedFieldsSchema.safeParse(parsed);
  if (!validated.success) {
    throw internalError(
      "CLAUDE_SCHEMA_MISMATCH",
      `JSON no cumple schema: ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  return {
    fields: validated.data,
    metadata: {
      modelUsed: model,
      latencyMs,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
    },
  };
}

/** Pipeline completo: PDF → texto → Claude → JSON validado. */
export async function extractFromMinuta(
  pdfBuffer: Buffer,
  modelOverride?: string,
): Promise<ExtractResult> {
  const pdfText = await extractTextFromPdf(pdfBuffer);
  const { fields, metadata } = await callClaudeForExtraction(pdfText, modelOverride);
  return { extractedFields: fields, metadata, pdfText };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripCodeFences(text: string): string {
  // Saca ```json\n...\n``` o ```\n...\n``` si Claude los agregó.
  const m = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1].trim() : text;
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un asistente especializado en interpretar minutas de visita técnico-comercial de instalaciones fotovoltaicas en Uruguay.

Tu tarea es extraer datos estructurados de una minuta y devolverlos como JSON.

Reglas:
- Si un dato NO está claramente en la minuta, devolvé null. NO inventes valores.
- Para texto libre (infoTecho, notasAdicionales), copiá textualmente o resumí sin agregar info que no esté.
- Para tipo de red: marcá true SOLO si está explícitamente mencionado.
- Para cantidad de paneles: respetá el formato del original (ej: "20 (8 mono, 12 tri)" para multi-instalación).
- Multi-instalación (caso COVITEJA): si menciona dos sistemas distintos (uno mono y otro tri), marcá ambos checkboxes red* como true y describí en infoTecho/notasAdicionales.

Devolvé SOLO el JSON. Sin texto antes o después. Sin markdown. Sin explicaciones.`;

const USER_PROMPT_PREFIX = `Extraé los siguientes datos de esta minuta y devolvé exactamente este JSON (sin propiedades extra):

{
  "tipoTecho": "ISOPANEL" | "HORMIGON" | "CHAPA" | "TEJAS" | "OTRO" | null,
  "tipoTechoOtro": string | null,
  "infoTecho": string | null,
  "alturaTecho": string | null,
  "cantidadPaneles": string | null,
  "potenciaPaneles": string | null,
  "inversor": string | null,
  "stringsLineasDc": string | null,
  "cableAc": string | null,
  "termicaAc": string | null,
  "diferencialAc": string | null,
  "largoCablesAcMts": string | null,
  "largoCablesDcMts": string | null,
  "redMonofasica": boolean,
  "redTrifasica230SN": boolean,
  "redTrifasica400CN": boolean,
  "notasAdicionales": string | null
}

Reglas de mapeo:
- tipoTecho: si menciona varios tipos en distintos sectores, elegí el principal o "OTRO".
- infoTecho: incluí dimensiones, inclinación, sectores, interferencias, observaciones del techo. Multi-línea OK.
- alturaTecho: solo si menciona explícitamente "1 piso", "PA", "PB", número de pisos, etc.
- cantidadPaneles: si menciona ampliación a futuro, usá la cantidad inicial. Multi-instalación = formato libre como "20 (8 mono, 12 tri)".
- inversor: incluí marca si la menciona (ej: "Huawei híbrido 10 kW"); si solo da potencia: "Inversor 6 kW".
- redMonofasica/Trifasica*: marcá true SOLO si la red eléctrica del cliente es ese tipo. Multi-instalación → varios true.
- notasAdicionales: concatená pendientes, aspectos comerciales, plazos, observaciones especiales que no entraron en otros campos. Excluí secciones repetitivas como "Objetivos de la visita".

MINUTA:
`;
