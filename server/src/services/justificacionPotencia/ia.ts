// Redacción con IA de los textos del informe de justificación de potencia.
// Opcional: el informe sale igual con el texto automático (`textos.ts`). La IA
// reescribe Objeto, Antecedentes, Justificación y Conclusión adaptándolos al
// caso, con el tono de los informes que Voltia ya mandó a UTE. Los números los
// pone el cálculo, no la IA: se le pasan hechos y se le prohíbe inventar otros.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { AppError } from "../../utils/errors.js";
import { createMessage } from "../ai/usage.js";
import { calcularBalance, fmtNum } from "./calculo.js";
import type { DatosJustificacion, Textos } from "./schema.js";
import { MOTIVO_ANTECEDENTE_LABELS, textosAutomaticos } from "./textos.js";

const MODEL = process.env.JUSTIFICACION_POTENCIA_MODEL ?? "claude-sonnet-4-5-20250929";

let client: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AppError(500, "ANTHROPIC_NOT_CONFIGURED", "ANTHROPIC_API_KEY no está configurada");
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

const SYSTEM_PROMPT = `Sos el ingeniero responsable de Voltia, instaladora fotovoltaica habilitada en Uruguay. Redactás informes técnicos dirigidos al Departamento de Seguimiento de Generadores Externos de UTE para justificar la potencia de una microgeneración cuando el consumo histórico de la cuenta no alcanza para el balance anual de energía (lo generado en un año no puede superar lo consumido en un año).

Estilo: español formal y técnico de Uruguay, impersonal ("se prevé", "se considera", "resulta"), sin adjetivos comerciales, sin exageraciones, sin listas ni markdown. Párrafos cortos separados por una línea en blanco.

Reglas duras:
- Usá SOLO los datos y números que se te dan. No inventes cargas, cuentas, potencias, porcentajes ni fechas.
- Los números van con formato uruguayo (1.600 kWh; 25,5 kW).
- No menciones a la IA ni a Voltia PM.
- "objeto": 1 párrafo.
- "antecedentes": 1 o 2 párrafos que expliquen por qué el consumo histórico no es representativo de la demanda futura, según la situación indicada y las cargas.
- "justificacion": 1 o 2 párrafos que comparen generación anual estimada con consumo anual proyectado.
- "conclusion": 1 o 2 párrafos; si el balance no cumple, concluí justificando solo la potencia que da el balance.`;

const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    objeto: { type: "string", description: "Sección 'Objeto del informe'." },
    antecedentes: { type: "string", description: "Sección 'Antecedentes'." },
    justificacion: { type: "string", description: "Sección 'Justificación del sistema fotovoltaico'." },
    conclusion: { type: "string", description: "Sección 'Conclusión'." },
  },
  required: ["objeto", "antecedentes", "justificacion", "conclusion"],
};

const respuestaSchema = z.object({
  objeto: z.string().min(1).max(4000),
  antecedentes: z.string().min(1).max(6000),
  justificacion: z.string().min(1).max(6000),
  conclusion: z.string().min(1).max(4000),
});

function promptDeDatos(d: DatosJustificacion): string {
  const b = calcularBalance(d);
  const auto = textosAutomaticos(d, b);
  const cargas = b.cargas
    .map((c) => {
      const det = c.carga.detalle?.trim() ? ` — ${c.carga.detalle.trim()}` : "";
      return `- ${c.carga.concepto}${det}: ${c.formula} = ${fmtNum(c.kwhMes)} kWh/mes`;
    })
    .join("\n");
  const notas = [d.textos.objeto, d.textos.antecedentes, d.textos.justificacion, d.textos.conclusion]
    .map((t) => t.trim())
    .filter(Boolean)
    .join("\n---\n");

  return `Datos del informe:
- Tipo de solicitud: ${d.tipoSolicitud === "AMPLIACION" ? "ampliación de una microgeneración existente" : "microgeneración nueva"}
- Cliente: ${d.cliente.nombre}${d.cliente.esEmpresa ? " (empresa)" : ""}
- Cuenta UTE: ${d.cliente.cuentaUte || "s/d"}
- Ubicación: ${d.cliente.ubicacion || "s/d"}
- Situación del suministro: ${MOTIVO_ANTECEDENTE_LABELS[d.motivoAntecedente]}
- Potencia de generación solicitada: ${fmtNum(b.potenciaSolicitadaKw, 2)} kW${d.potenciaUteKw ? ` (UTE indicó que el balance actual da para ${fmtNum(d.potenciaUteKw, 2)} kW)` : ""}

Cargas proyectadas:
${cargas}

Balance anual (ya calculado, usá estos números):
- Consumo anual actual: ${b.consumoActualEstimadoDesdeUte ? `${fmtNum(b.consumoAnualActualKwh)} kWh (aproximado, no es una lectura: decí "del orden de" y no expliques cómo se calculó ni cites la respuesta de UTE)` : b.consumoAnualActualKwh > 0 ? `${fmtNum(b.consumoAnualActualKwh)} kWh` : "cuenta nueva, sin consumo registrado"}
- Incremento: ${fmtNum(b.incrementoMensualKwh)} kWh/mes = ${fmtNum(b.incrementoAnualKwh)} kWh/año
- Consumo anual proyectado: ${fmtNum(b.consumoAnualProyectadoKwh)} kWh
- Generación anual estimada: ${fmtNum(b.generacionAnualKwh)} kWh (${fmtNum(b.productividadKwhKw)} kWh por kW instalado)
- ¿Cumple el balance?: ${b.cumpleBalance ? "sí" : `no; el consumo justifica hasta ${fmtNum(b.potenciaJustificadaKw, 2)} kW`}
${notas ? `\nNotas y textos que ya escribió el proyectista (respetá su contenido y sumalo):\n${notas}\n` : ""}
Texto base de referencia (mejoralo y adaptalo al caso, sin cambiar los números):
OBJETO: ${auto.objeto}
ANTECEDENTES: ${auto.antecedentes}
JUSTIFICACIÓN: ${auto.justificacion}
CONCLUSIÓN: ${auto.conclusion}`;
}

export async function redactarTextosConIa(
  d: DatosJustificacion,
  ctx: { userId: string; projectId: string },
): Promise<Textos> {
  const response = await createMessage(
    getAnthropicClient(),
    "justificacion_potencia",
    {
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: promptDeDatos(d) }],
      tools: [
        {
          name: "redactar_informe",
          description: "Devolver los cuatro textos del informe de justificación de potencia.",
          input_schema: TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "redactar_informe" },
    },
    { userId: ctx.userId, projectId: ctx.projectId },
  );

  if (response.stop_reason === "max_tokens") {
    throw new AppError(500, "CLAUDE_RESPONSE_TRUNCATED", "La respuesta de la IA se cortó. Probá de nuevo.");
  }
  const bloque = response.content.find((c) => c.type === "tool_use");
  if (!bloque || bloque.type !== "tool_use") {
    throw new AppError(500, "CLAUDE_NO_TOOL", "La IA no devolvió los textos del informe");
  }
  const parsed = respuestaSchema.safeParse(bloque.input);
  if (!parsed.success) {
    throw new AppError(500, "CLAUDE_SCHEMA_MISMATCH", "La IA devolvió textos con un formato inesperado");
  }
  const limpiar = (t: string) => t.replace(/\*\*/g, "").trim();
  return {
    objeto: limpiar(parsed.data.objeto),
    antecedentes: limpiar(parsed.data.antecedentes),
    justificacion: limpiar(parsed.data.justificacion),
    conclusion: limpiar(parsed.data.conclusion),
  };
}
