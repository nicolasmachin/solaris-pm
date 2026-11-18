// Análisis con IA de un caso de Soporte: que la falla llegue a la mesa ya
// mirada.
//
// La revisión automática dice QUÉ pasa ahora (el último dato del inversor). Lo
// que faltaba es lo que hace un técnico después: mirar los días anteriores, la
// curva, las alarmas de meses, el historial cada 5 minutos si hace falta, y
// buscar si ya pasó en otra obra. Eso lo hace Claude con las MISMAS
// herramientas de lectura del conector (`abrirHerramientas`), y decide él si
// vale la pena bajar el historial.
//
// Se pide solo al abrir una falla del inversor o un "no genera", y otra vez si
// el caso cambia de tipo. "No comunica" no: sin datos no hay qué mirar. Desde
// la mesa se puede pedir a mano para cualquier caso.
//
// Recursos (pedido del 28-oct-2026: nada de procesos que queden abiertos): uno
// por vez, en cola, con tope de vueltas y de tiempo. Corre fuera de la vuelta
// del vigía, que no espera.

import Anthropic from "@anthropic-ai/sdk";
import { SoporteCasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import type { McpUser } from "../../routes/mcp/context.js";
import { abrirHerramientas } from "../asistente/herramientas.js";
import { createMessage } from "../ai/usage.js";

const MODEL = process.env.SOPORTE_IA_MODEL ?? "claude-sonnet-5-5";
const MAX_VUELTAS = 10;
const TOPE_MS = 5 * 60_000;

/** Los tipos que se analizan solos al abrirse. */
export const TIPOS_ANALIZABLES: SoporteCasoTipo[] = [SoporteCasoTipo.FALLA_INVERSOR, SoporteCasoTipo.SIN_GENERACION];

/** Solo las de mirar una planta: no hace falta que vea leads ni finanzas. */
const HERRAMIENTAS = new Set([
  "generacion_planta",
  "curva_horaria",
  "estado_en_vivo",
  "alarmas_planta",
  "historial_inversor",
  "buscar_casos_tecnicos",
  "ficha_generador",
]);

export function analisisHabilitado(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.SOPORTE_IA !== "0";
}

let anthropic: Anthropic | null = null;
function cliente(): Anthropic {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

/**
 * Las herramientas actúan siempre en nombre de un usuario real (los permisos
 * salen de su rol). Para el análisis automático: el de `SOPORTE_IA_USUARIO`
 * (email) o el primer ADMIN. Solo lee.
 */
async function usuarioDelAnalisis(): Promise<McpUser | null> {
  const email = process.env.SOPORTE_IA_USUARIO;
  const u = await prisma.user.findFirst({
    where: email ? { email, deletedAt: null } : { role: { name: "ADMIN" }, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: { select: { name: true } } },
  });
  return u ? { id: u.id, email: u.email ?? "", name: u.name, role: u.role.name } : null;
}

const INSTRUCCIONES = `Sos el técnico de soporte de Voltia, empresa uruguaya de energía solar (microgeneración conectada a UTE). La revisión automática de Voltia PM acaba de detectar un problema en una planta y vos tenés que dejarlo pre analizado para la persona de Experiencia Solar u Operaciones que lo va a mirar.

Cómo trabajás:
- Mirás los datos antes de opinar. Primero buscar_casos_tecnicos (con la marca, el modelo o el código de falla: si ya pasó en otra obra, la solución está ahí). Después generacion_planta (últimos 30 días: ¿venía bien?, ¿desde cuándo?, ¿pasó otros días?) y alarmas_planta (meses: ¿el código se repite?, ¿a qué hora?).
- El historial cada 5 minutos (historial_inversor) se baja SOLO si hace falta para entender la causa: una falla con código, un aislamiento bajo, una entrada o un string sospechoso, un recorte, días rojos sin explicación. Elegí los días que importan (los de alarmas o baja generación, hasta 14) y no pidas el Excel.
- curva_horaria y estado_en_vivo si ayudan (arranque tarde, cortes, cómo está ahora).
- Los Growatt tienen historial y alarmas; los Huawei, solo generación, curva y estado.
- Si "no ve la red" con los paneles con tensión, casi siempre es la llave de microgeneración bajada o saltada, y la puede subir el cliente: decilo.
- No inventes. Si los datos no alcanzan, decilo.

Respondé SOLO con el análisis, en español rioplatense, en Markdown, corto (hasta unas 180 palabras), con estas cuatro partes en negrita:
**Qué pasa**: lo que muestran los datos, con fechas, horas y valores (✅ dato).
**Causa probable**: tu deducción, en orden de probabilidad (⚠️ deducción).
**Qué hacer**: quién y qué: el cliente sube la llave, Experiencia Solar le avisa, Operaciones va con tal cosa (instrumento, repuesto), reclamo de garantía al fabricante.
**Energía perdida**: si se puede estimar, cuánto (kWh) y desde cuándo; si no, omitila.
No nombres tus herramientas ni digas que sos una IA.`;

function contexto(c: {
  id: string;
  projectId: string;
  tipo: SoporteCasoTipo;
  titulo: string;
  detalle: string;
  detectadoEn: Date;
  codigoFalla: number | null;
  growattPlantId: bigint | null;
  huaweiPlantCode: string | null;
  project: { clientName: string; capacityKwp: unknown };
}): string {
  const fmt = (d: Date) =>
    d.toLocaleString("es-UY", { timeZone: "America/Montevideo", dateStyle: "short", timeStyle: "short", hourCycle: "h23" });
  return `Caso de Soporte:
- Cliente: ${c.project.clientName} (project_id: ${c.projectId})
- Potencia: ${c.project.capacityKwp != null ? `${Number(c.project.capacityKwp)} kWp` : "s/d"}
- Marca: ${c.growattPlantId != null ? "Growatt" : c.huaweiPlantCode ? "Huawei" : "s/d"}
- Tipo: ${c.tipo}${c.codigoFalla != null ? ` (código ${c.codigoFalla})` : ""}
- Detectado: ${fmt(c.detectadoEn)}
- Ahora: ${fmt(new Date())}
- Qué vio la revisión automática: ${c.titulo}. ${c.detalle}`;
}

async function analizar(casoId: string): Promise<void> {
  const c = await prisma.soporteCaso.findUnique({
    where: { id: casoId },
    select: {
      id: true,
      projectId: true,
      tipo: true,
      titulo: true,
      detalle: true,
      detectadoEn: true,
      codigoFalla: true,
      growattPlantId: true,
      huaweiPlantCode: true,
      project: { select: { clientName: true, capacityKwp: true } },
    },
  });
  if (!c) return;
  const user = await usuarioDelAnalisis();
  if (!user) throw new Error("no hay un usuario ADMIN para leer los datos de la planta");

  const herramientas = await abrirHerramientas(user);
  try {
    const tools = herramientas.definiciones.filter((t) => HERRAMIENTAS.has(t.name));
    const mensajes: Anthropic.MessageParam[] = [{ role: "user", content: contexto(c) }];
    const t0 = Date.now();
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      // La última vuelta (o pasado el tope de tiempo) sin herramientas: que cierre con lo que tiene.
      const ultima = vuelta === MAX_VUELTAS - 1 || Date.now() - t0 > TOPE_MS;
      // `output_config` (esfuerzo) es más nuevo que los tipos del SDK instalado.
      const params = {
        model: MODEL,
        max_tokens: 8000,
        system: INSTRUCCIONES,
        ...(ultima ? {} : { tools }),
        messages: mensajes,
        output_config: { effort: "medium" },
      } as Anthropic.MessageCreateParamsNonStreaming;
      const res = await createMessage(cliente(), "soporte_analisis", params, { projectId: c.projectId, entityId: c.id });

      const pedidos = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || pedidos.length === 0) {
        const texto = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n\n")
          .trim();
        if (!texto) throw new Error("la IA no devolvió texto");
        await prisma.soporteCaso.update({
          where: { id: c.id },
          data: { analisisIa: texto, analisisIaEstado: "LISTO", analisisIaEn: new Date() },
        });
        return;
      }
      mensajes.push({ role: "assistant", content: res.content });
      const resultados = await Promise.all(
        pedidos.map(async (p) => {
          const r = HERRAMIENTAS.has(p.name)
            ? await herramientas.llamar(p.name, p.input)
            : { texto: `"${p.name}" no está disponible.`, error: true };
          return { type: "tool_result" as const, tool_use_id: p.id, content: r.texto, is_error: r.error || undefined };
        }),
      );
      mensajes.push({ role: "user", content: resultados });
    }
    throw new Error("demasiadas vueltas");
  } finally {
    await herramientas.cerrar();
  }
}

// Uno por vez: la cola es una cadena de promesas en memoria. Si el server se
// reinicia con algo en cola, queda en ANALIZANDO y se pide de nuevo a mano.
let cola: Promise<void> = Promise.resolve();
const enCola = new Set<string>();

/** Marca el caso como "analizando" y lo pone en la cola. No espera. */
export async function pedirAnalisis(casoId: string): Promise<void> {
  if (!analisisHabilitado() || enCola.has(casoId)) return;
  enCola.add(casoId);
  // El tipo se anota al pedirlo, no al terminar: si falla, la revisión de
  // la media hora siguiente no lo vuelve a pedir (y a pagar) cada vez.
  const c = await prisma.soporteCaso.findUnique({ where: { id: casoId }, select: { tipo: true } });
  if (!c) return void enCola.delete(casoId);
  await prisma.soporteCaso.update({ where: { id: casoId }, data: { analisisIaEstado: "ANALIZANDO", analisisIaTipo: c.tipo } });
  cola = cola.then(async () => {
    try {
      await analizar(casoId);
    } catch (err) {
      console.error(`[soporte] no se pudo analizar el caso ${casoId} con IA:`, (err as Error).message);
      await prisma.soporteCaso
        .update({ where: { id: casoId }, data: { analisisIaEstado: "ERROR" } })
        .catch(() => undefined);
    } finally {
      enCola.delete(casoId);
    }
  });
}

/**
 * Lo llama la revisión automática después de abrir o actualizar un caso: lo
 * analiza si es de un tipo analizable y todavía no se pidió con ese tipo.
 */
export async function analizarSiCorresponde(casoId: string): Promise<void> {
  if (!analisisHabilitado()) return;
  const c = await prisma.soporteCaso.findUnique({
    where: { id: casoId },
    select: { tipo: true, estado: true, analisisIaTipo: true },
  });
  if (!c || c.estado !== "ABIERTO" || !TIPOS_ANALIZABLES.includes(c.tipo)) return;
  if (c.analisisIaTipo === c.tipo) return;
  await pedirAnalisis(casoId);
}
