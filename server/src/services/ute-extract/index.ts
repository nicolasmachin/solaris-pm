// Extracción de datos del cliente desde cédula y/o factura UTE usando
// Claude Haiku 4.5. Devuelve un objeto plano con los campos extraíbles —
// null cuando el campo no es visible en el documento.
//
// Modelo: claude-haiku-4-5 (más barato que Sonnet; suficiente para extracción
// estructurada de documentos). El SDK acepta image (base64) para JPG/PNG y
// document (base64) para PDFs sin conversión previa.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const MODEL_ID = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;

// Lazy: una sola instancia del cliente por proceso. La API key sale de
// process.env igual que el resto de services (efp, visit-report, minutaExtraction).
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurado");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export const ExtractedDataSchema = z.object({
  nombre_cliente: z.string().nullable(),
  ci_cliente: z.string().nullable(),
  dir_cliente: z.string().nullable(),
  calle: z.string().nullable(),
  num_calle: z.string().nullable(),
  ciudad: z.string().nullable(),
  depto: z.string().nullable(),
  mail_cliente: z.string().nullable(),
  telefono_cliente: z.string().nullable(),
  cuenta_ute: z.string().nullable(),
  caso_ute: z.string().nullable(),
  oficina_ute: z.string().nullable(),
  tarifa_ute: z.string().nullable(),
  pot_contratada: z.string().nullable(),
  persona_fisica: z.boolean().nullable(),
});
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

export type DocTipo = "cedula" | "factura_ute";

// Valida el dígito verificador de una cédula uruguaya (7 dígitos + verificador).
// Sirve para descartar números que la IA "inventa" a partir de una fecha
// (p. ej. leer el Vencimiento 24/08/2027 como CI 2.408.202-7, que NO valida).
// Devuelve false para RUTs u otros formatos: el caller solo valida si parece CI.
export function esCiUruguayaValida(raw: string): boolean {
  const clean = raw.replace(/\D/g, "");
  if (clean.length < 7 || clean.length > 8) return false;
  const padded = clean.padStart(8, "0");
  const numero = padded.slice(0, 7).split("").map(Number);
  const verificador = Number(padded[7]);
  const pesos = [2, 9, 8, 7, 6, 3, 4];
  const suma = numero.reduce((acc, d, i) => acc + d * pesos[i], 0);
  const esperado = (10 - (suma % 10)) % 10;
  return esperado === verificador;
}

// Si el ci_cliente extraído PARECE una cédula (7-8 dígitos) pero NO valida el
// dígito verificador, lo descartamos (null) en vez de guardar un número falso.
// RUTs (11-12 dígitos) y otros se dejan pasar sin validar.
function sanearCi(ci: string | null): string | null {
  if (!ci) return ci;
  const digitos = ci.replace(/\D/g, "");
  if (digitos.length >= 7 && digitos.length <= 8 && !esCiUruguayaValida(ci)) {
    console.warn(`[ute-extract] ci_cliente descartado: "${ci}" no valida el dígito verificador (probable fecha mal leída)`);
    return null;
  }
  return ci;
}

const PROMPT_CEDULA = `Sos un asistente de extracción de datos. Analizá esta imagen de cédula de identidad uruguaya y extraé los datos disponibles.

Devolvé ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin texto adicional, sin markdown, sin backticks):
{
  "nombre_cliente": "nombre completo tal como figura o null",
  "ci_cliente": "el número rotulado 'N° de Identidad' (formato X.XXX.XXX-X, 7 dígitos + 1 verificador), sin puntos ni guiones, o null",
  "dir_cliente": "dirección completa si figura o null",
  "calle": "nombre de la calle sin número o null",
  "num_calle": "número de la calle como string o null",
  "ciudad": "ciudad o localidad o null",
  "depto": "departamento o null",
  "mail_cliente": null,
  "telefono_cliente": null,
  "cuenta_ute": null,
  "caso_ute": null,
  "oficina_ute": null,
  "tarifa_ute": null,
  "pot_contratada": null,
  "persona_fisica": true
}

IMPORTANTE sobre ci_cliente: es el número rotulado "N° de Identidad" (o "N° de Identidade"). NUNCA uses las fechas de Expedición, Vencimiento ni de Nacimiento como cédula. Si no ves claramente el "N° de Identidad", devolvé null.

Si un campo no es visible o no figura en el documento, usá null. No inventes datos. Solo extraé lo que esté claramente visible.`;

const PROMPT_FACTURA = `Sos un asistente de extracción de datos. Analizá este documento que es una factura de UTE (empresa eléctrica de Uruguay) y extraé los datos disponibles.

Devolvé ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin texto adicional, sin markdown, sin backticks):
{
  "nombre_cliente": "nombre del titular de la cuenta o null",
  "ci_cliente": "CI (X.XXX.XXX-X) o RUT del titular si figura, sin puntos ni guiones — nunca una fecha, o null",
  "dir_cliente": "dirección del suministro completa o null",
  "calle": "nombre de la calle sin número o null",
  "num_calle": "número de la calle como string o null",
  "ciudad": "ciudad o localidad del suministro o null",
  "depto": "departamento del suministro o null",
  "mail_cliente": "email del cliente si figura o null",
  "telefono_cliente": "teléfono del cliente si figura o null",
  "cuenta_ute": "número de cuenta UTE (suele ser un número largo) o null",
  "caso_ute": null,
  "oficina_ute": "oficina comercial UTE indicada en la factura o null",
  "tarifa_ute": "código de tarifa (ej: BT1, BT2, MT1) o null",
  "pot_contratada": "potencia contratada en kW como string numérico o null",
  "persona_fisica": true
}

Si un campo no es visible o no figura en el documento, usá null. No inventes datos. Solo extraé lo que esté claramente visible.`;

export async function extractFromDocument(args: {
  fileBuffer: Buffer;
  mimeType: string;
  tipo: DocTipo;
}): Promise<{ data: ExtractedData; tokensInput: number; tokensOutput: number }> {
  const { fileBuffer, mimeType, tipo } = args;
  const base64 = fileBuffer.toString("base64");
  const prompt = tipo === "cedula" ? PROMPT_CEDULA : PROMPT_FACTURA;

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  if (!isImage && !isPdf) {
    throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
  }

  // Tipos discriminados de la SDK: image vs document.
  const contentBlock = isImage
    ? {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mimeType as "image/jpeg" | "image/png",
          data: base64,
        },
      }
    : {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: base64,
        },
      };

  const response = await getClient().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [contentBlock, { type: "text", text: prompt }],
      },
    ],
  });

  const rawText = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  // Claude a veces envuelve la respuesta en ```json ... ``` aunque le pidamos
  // que no lo haga. Strippeamos por las dudas.
  const clean = rawText.replace(/```json|```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Claude devolvió JSON inválido: ${rawText.slice(0, 200)}`);
  }
  const data = ExtractedDataSchema.parse(parsed);
  // Red de seguridad: descartar un CI que no valida el dígito verificador
  // (típico cuando la IA confunde una fecha con la cédula).
  data.ci_cliente = sanearCi(data.ci_cliente);

  return {
    data,
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  };
}
