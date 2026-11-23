/**
 * "¿Esta conversación de WhatsApp cumple algún paso del recorrido?"
 *
 * Cuando Experiencia Solar le escribe al cliente desde el celular, la
 * conversación del día queda en el historial (ver `registrarConversacionDelDia`)
 * pero el paso que se hizo ("le mandé el material de capacitación") quedaba sin
 * tildar si nadie se acordaba. Acá la IA lee la conversación y marca qué pasos
 * pendientes PARECE cumplir.
 *
 * Nunca cierra un paso sola: deja una sugerencia en el paso (`sugerenciaIa`) y
 * Experiencia Solar la confirma o la descarta con un toque. Un paso tildado por
 * error es peor que uno sin tildar: apaga la alerta y nadie lo vuelve a mirar.
 *
 * Corre unos minutos después del último mensaje del día (no por cada mensaje)
 * y solo si Voltia escribió algo: un día en que solo escribió el cliente no
 * cumple ningún aviso.
 */

import Anthropic from "@anthropic-ai/sdk";
import { InteractionDirection, type Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { createMessage } from "../ai/usage.js";
import { CHECKS_POR_RECORRIDO } from "./recorrido-checks.js";

const MODEL_ID = process.env.RECORRIDO_IA_MODEL ?? "claude-sonnet-4-5-20250929";
/** Cuánto se espera desde el último mensaje: una conversación viene de a ráfagas. */
const DEMORA_MS = Number(process.env.RECORRIDO_IA_DEMORA_MS ?? 10 * 60_000);

export type SugerenciaPaso = {
  motivo: string;
  interaccionId: string;
  at: string;
  descartada?: boolean;
  aceptada?: boolean;
};

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurado");
  _client = new Anthropic({ apiKey });
  return _client;
}

const Respuesta = z.object({
  pasos: z.array(z.object({ codigo: z.string(), motivo: z.string().min(1).max(300) })),
});

const pendientes = new Map<string, NodeJS.Timeout>();

/**
 * Programa la revisión de la conversación del día. Cada mensaje nuevo reinicia
 * la espera. Si el server se reinicia en el medio, esa revisión se pierde: es
 * una ayuda, el paso se puede tildar a mano igual.
 */
export function programarSugerenciaPasos(projectId: string, interaccionId: string): void {
  if (!process.env.ANTHROPIC_API_KEY) return;
  const previo = pendientes.get(projectId);
  if (previo) clearTimeout(previo);
  const t = setTimeout(() => {
    pendientes.delete(projectId);
    void sugerirPasos(projectId, interaccionId).catch((err) =>
      console.error(`[recorrido-ia] ${projectId}:`, err instanceof Error ? err.message : err),
    );
  }, DEMORA_MS);
  t.unref?.();
  pendientes.set(projectId, t);
}

function sugerenciaDe(v: Prisma.JsonValue | null): SugerenciaPaso | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as unknown as SugerenciaPaso;
}

/** Revisa la conversación y deja sugerencias en los pasos. Devuelve cuántas dejó. */
export async function sugerirPasos(projectId: string, interaccionId: string): Promise<number> {
  const interaccion = await prisma.clientInteraction.findUnique({
    where: { id: interaccionId },
    select: { content: true, direction: true, deletedAt: true, projectId: true },
  });
  if (!interaccion || interaccion.deletedAt || interaccion.projectId !== projectId) return 0;
  if (interaccion.direction !== InteractionDirection.SALIENTE) return 0;

  // Solo los pasos que ya corren (tienen plazo) o los de reagenda: uno sin plazo
  // todavía no le tocó, y sugerirlo sería adivinar.
  const abiertos = await prisma.recorridoCheck.findMany({
    where: { projectId, completadoEn: null, OR: [{ venceEn: { not: null } }, { esDinamico: true }] },
    select: { id: true, recorrido: true, codigo: true, titulo: true, nota: true, sugerenciaIa: true },
  });
  const candidatos = abiertos.filter((c) => {
    const s = sugerenciaDe(c.sugerenciaIa);
    // Ya sugerido y sin responder: no se pregunta de nuevo. Descartado para esta
    // misma conversación: tampoco. Otro día, sí.
    if (!s) return true;
    if (s.descartada) return s.interaccionId !== interaccionId;
    return false;
  });
  if (candidatos.length === 0) return 0;

  const lista = candidatos.map((c) => {
    const def = (CHECKS_POR_RECORRIDO[c.recorrido] ?? []).find((d) => d.codigo === c.codigo);
    return { codigo: c.codigo, paso: c.titulo, comoSeHace: def?.detalle ?? null, contexto: c.nota };
  });

  const prompt = `Sos el asistente de Experiencia Solar de Voltia (empresa uruguaya que instala energía solar). Experiencia Solar acompaña al cliente desde que firma hasta después de que su planta está habilitada, y tiene una lista de avisos que le tiene que dar en cada etapa.

Abajo va la conversación de WhatsApp de hoy entre Voltia y el cliente, y los avisos que todavía están pendientes. Decidí cuáles de esos avisos quedaron CUMPLIDOS en esta conversación.

Criterio:
- Cuenta lo que Voltia le dijo o le mandó al cliente, no lo que el cliente preguntó.
- Tiene que estar claro en el texto. Si es dudoso, parcial o solo se lo mencionó al pasar, NO lo marques.
- Un audio cuenta por su transcripción. Un archivo o una foto cuenta solo si el texto alrededor deja claro qué era.
- Es mejor no marcar nada que marcar de más: una persona va a confirmar cada sugerencia.

Avisos pendientes:
${JSON.stringify(lista, null, 1)}

Conversación:
${interaccion.content}

Respondé SOLO un JSON: {"pasos":[{"codigo":"<codigo del aviso>","motivo":"<en una frase corta, en castellano rioplatense, qué se le dijo o mandó que lo cumple>"}]}. Si ninguno se cumplió: {"pasos":[]}.`;

  const r = await createMessage(
    getClient(),
    "whatsapp_recorrido",
    { model: MODEL_ID, max_tokens: 1000, messages: [{ role: "user", content: prompt }] },
    { projectId, entityId: interaccionId },
  );
  const raw = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").replace(/```json|```/g, "").trim();
  let parsed: z.infer<typeof Respuesta>;
  try {
    parsed = Respuesta.parse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
  } catch {
    console.error(`[recorrido-ia] respuesta inválida para ${projectId}: ${raw.slice(0, 200)}`);
    return 0;
  }

  let dejadas = 0;
  const at = new Date().toISOString();
  for (const p of parsed.pasos) {
    const c = candidatos.find((x) => x.codigo === p.codigo);
    if (!c) continue;
    const valor: SugerenciaPaso = { motivo: p.motivo, interaccionId, at };
    await prisma.recorridoCheck.updateMany({
      where: { id: c.id, completadoEn: null },
      data: { sugerenciaIa: valor as unknown as Prisma.InputJsonValue },
    });
    dejadas++;
  }
  return dejadas;
}

/** Lo que la pantalla muestra: solo la sugerencia viva de un paso pendiente. */
export function sugerenciaVisible(
  c: { completadoEn: Date | null; sugerenciaIa: Prisma.JsonValue | null },
): { motivo: string; at: string } | null {
  if (c.completadoEn) return null;
  const s = sugerenciaDe(c.sugerenciaIa);
  if (!s || s.descartada || s.aceptada) return null;
  return { motivo: s.motivo, at: s.at };
}

/** Marca la sugerencia como respondida, sin perder qué había dicho la IA. */
export async function marcarSugerencia(checkId: string, como: "aceptada" | "descartada"): Promise<void> {
  const c = await prisma.recorridoCheck.findUnique({ where: { id: checkId }, select: { sugerenciaIa: true } });
  const s = sugerenciaDe(c?.sugerenciaIa ?? null);
  if (!s) return;
  await prisma.recorridoCheck.update({
    where: { id: checkId },
    data: { sugerenciaIa: { ...s, [como]: true } as unknown as Prisma.InputJsonValue },
  });
}
