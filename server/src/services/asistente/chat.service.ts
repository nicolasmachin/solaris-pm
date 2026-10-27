// Asistente del equipo: chat con Claude sobre la base de conocimiento y los
// datos reales de Voltia PM.
//
// Cada consulta es independiente del lado del server: el panel manda la
// conversación (solo texto) y acá se arma el prompt, se corre el ciclo de
// herramientas y se devuelve la respuesta. No se guarda la conversación; el
// gasto sí, en `ai_usage`, a nombre del usuario.
//
// Prompt, en este orden (y así se cachea): herramientas → instrucciones →
// base de conocimiento [caché] → contexto de la pantalla → conversación.
// Lo que cambia entre consultas va después del punto de caché.

import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "../../lib/prisma.js";
import type { McpUser } from "../../routes/mcp/context.js";
import { costoAnthropic } from "../ai/pricing.js";
import { createMessage } from "../ai/usage.js";
import { ENCICLOPEDIAS, leerBase, leerEnciclopedia } from "./base.js";
import { notasDe } from "./historial.service.js";
import { abrirHerramientas } from "./herramientas.js";

export const MODELOS = {
  haiku: { id: "claude-haiku-5-5", nombre: "Haiku (rápido)" },
  sonnet: { id: "claude-sonnet-5-5", nombre: "Sonnet" },
  opus: { id: "claude-opus-5-5", nombre: "Opus (el más capaz)" },
} as const;

export type ModeloElegido = keyof typeof MODELOS | "auto";

/** Herramienta propia del chat (no del conector): abre una sección de una enciclopedia. */
const HERRAMIENTA_ENCICLOPEDIA: Anthropic.Tool = {
  name: "leer_enciclopedia",
  description:
    "Abre una sección de una de las enciclopedias de la base de conocimiento (en el prompt solo está su índice). " +
    "Usala cuando la pregunta toca un tema que está en el índice de una enciclopedia y no en los archivos por tema: " +
    "cotizador y markup, criterios técnicos de venta, plantillas, objeciones, cotizaciones no estándar, ingeniería, " +
    "soporte Growatt, obras y casos de referencia. Podés abrir varias secciones.",
  input_schema: {
    type: "object",
    properties: {
      archivo: { type: "string", enum: ENCICLOPEDIAS, description: "Qué enciclopedia" },
      seccion: {
        type: "string",
        description: 'Número de la sección de primer nivel ("6") o parte de su título ("Precio, markup")',
      },
    },
    required: ["archivo", "seccion"],
  },
};

/** Vueltas máximas de herramientas por mensaje: corta un ciclo que no termina. */
const MAX_VUELTAS = 12;

let anthropic: Anthropic | null = null;
function cliente(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");
  if (!anthropic) anthropic = new Anthropic({ apiKey });
  return anthropic;
}

export function asistenteHabilitado(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Modo automático: Sonnet para todo, Opus para el trabajo pesado (un listado
 * largo de preguntas o redactar lo que se le manda a un cliente, o un PDF,
 * Word o Excel adjunto). Es una regla
 * fija y no una consulta previa a otro modelo: es instantánea, no cuesta y es
 * predecible.
 */
export function elegirModelo(elegido: ModeloElegido, mensaje: string, conDocumentos = false): keyof typeof MODELOS {
  if (elegido !== "auto") return elegido;
  if (conDocumentos) return "opus";
  const preguntasNumeradas = (mensaje.match(/^\s*\d+[.)-]\s+/gm) ?? []).length;
  const signosPregunta = (mensaje.match(/\?/g) ?? []).length;
  const pideRedaccion =
    /\b(redact|arm[aá]|escrib|prepar)\w*\b[^.?!\n]{0,60}\b(respuesta|informe|nota|mail|correo|carta|documento)\b/i.test(mensaje) ||
    /\b(respond|contest)\w*\b[^.?!\n]{0,40}\bal cliente\b/i.test(mensaje);
  if (mensaje.length > 2500 || preguntasNumeradas >= 4 || signosPregunta >= 5 || pideRedaccion) return "opus";
  return "sonnet";
}

function instrucciones(): string {
  return `Sos el asistente interno de Voltia, empresa uruguaya de energía solar fotovoltaica (microgeneración). Te usa el equipo de Voltia (asesores comerciales, Experiencia Solar, Operaciones, Ingeniería, Dirección) desde Voltia PM, el sistema interno de la empresa.

Para qué estás:
- Contestar preguntas del equipo sobre cómo trabaja Voltia, criterios, precios de referencia, UTE, equipos, techos, garantías, pagos, ingeniería y soporte.
- Consultar los datos reales de clientes, leads, proyectos, propuestas, obras y plantas con las herramientas. Siempre que la pregunta sea sobre un cliente concreto, buscá el dato con las herramientas en vez de suponerlo.
- Ayudar a armar respuestas para clientes: cuando el usuario pega preguntas de un cliente, buscá los datos del lead (propuesta, minuta de visita, documentos) y redactá un borrador listo para revisar.

Análisis técnico de una planta (genera poco, se corta, arranca tarde, "algo raro hay", un código de falla, un reclamo del cliente):
- No te quedes en hipótesis: tenés acceso a los datos del inversor y los tenés que mirar antes de opinar. Seguí este recorrido y usá todo lo que haga falta, sin esperar a que te lo pidan:
  1. generacion_planta: los días del período y la comparación con el resto de la cartera (¿rinde menos?, ¿qué días?).
  2. curva_horaria: la forma del día (arranque tarde, mesetas, cortes, exportar de noche).
  3. alarmas_planta: el registro de alarmas de Growatt, de meses (código, nombre, cuántas veces, qué días, qué sugiere Growatt).
  4. historial_inversor: el detalle cada 5 minutos de los días que importan (hasta 14): estado en falla con sol, aislamiento (pvIso), cada entrada y cada string, red, temperatura. Ofrecé el Excel; si la persona lo pide, pedilo con excel.
  5. estado_en_vivo: cómo está ahora mismo.
- Para elegir los días del historial, usá lo que viste en los pasos 1 a 3 (los días con alarmas o con baja generación). Si no está claro, empezá por ayer.
- Los Growatt tienen historial y alarmas (MIN/TLX y MAX/MID/MAC). Los Huawei tienen generación, curva y estado, pero no historial ni alarmas por esta vía.
- Cerrá con: qué pasa (✅ lo que muestran los datos), por qué puede pasar (⚠️), qué se revisa en el lugar y quién (Operaciones, con un ticket si hace falta), y cuánta energía se está perdiendo si se puede estimar.

Reglas:
- Le hablás a la persona del equipo que te escribe (su nombre está en el contexto): tratala por su nombre de pila cuando venga natural, sin forzarlo en cada respuesta. Español rioplatense, voseo, claro y directo. Podés usar información interna.
- Si tenés notas sobre esa persona (de conversaciones anteriores), usalas para responder como le sirve, sin mencionarlas.
- No nombres tus herramientas internas (ficha_lead, ver_propuesta…): decí qué consultaste en palabras. Si una herramienta te dio un enlace (por ejemplo, el PDF de una propuesta), pasalo como enlace.
- Cuando redactes algo para un cliente, respetá lo que la base marca como interno o "no se le dice al cliente", usá el trato (vos o usted) que corresponda y seguí los criterios de tono de la base.
- Marcá de dónde sale cada afirmación importante: ✅ dato (de la base o de Voltia PM), ⚠️ deducción tuya (hay que revisarla), ❓ no se sabe o lo decide Voltia (no lo inventes; decí quién lo tiene que contestar).
- Las condiciones comerciales no las decidís vos: descuentos, cambios en la forma de pago, incluir algo que la propuesta excluye, la garantía de generación. Marcalas ❓ para quien vende.
- Los números que cambian (tarifas, tasas, precios) salen de cifras-vigentes.md, con su fecha.
- Lo marcado [A CONFIRMAR] o [A DECIDIR] no se afirma como política cerrada.
- Si la base y los datos de Voltia PM no alcanzan, decilo. Es mejor un "no sé, preguntale a X" que un dato inventado.
- Si te piden algo que cambia datos (crear un lead, mover una etapa, publicar una propuesta), explicá que desde este chat todavía no se puede y que se hace desde la pantalla correspondiente.
- Si te adjuntan archivos (fotos, PDF, planillas), analizalos y citá de dónde sacás cada dato. En mensajes posteriores los adjuntos anteriores aparecen solo por nombre: si necesitás volver a mirarlos, pedile a la persona que los adjunte de nuevo.
- Respuestas cortas cuando la pregunta es corta. Usá Markdown (listas, negritas, tablas) cuando ayude a leer.

A continuación está la base de conocimiento de Voltia. Ante contradicciones, manda lo que dice su README.`;
}

export type MensajeChat = { role: "user" | "assistant"; content: string };
export type ContextoPantalla = { leadId?: string | null; projectId?: string | null };

async function textoContexto(user: McpUser, ctx: ContextoPantalla): Promise<string> {
  const hoy = new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/Montevideo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const lineas = [`Hoy es ${hoy}. Te escribe: ${user.name} (rol ${user.role}).`];
  const notas = await notasDe(user.id).catch(() => null);
  if (notas) lineas.push(`Notas sobre ${user.name}, de conversaciones anteriores:\n${notas}`);

  if (ctx.leadId) {
    const lead = await prisma.salesLead
      .findUnique({ where: { id: ctx.leadId }, select: { code: true, clientName: true } })
      .catch(() => null);
    if (lead) {
      lineas.push(
        `Tiene abierto el cliente potencial ${lead.clientName} (${lead.code}, lead_id ${ctx.leadId}). ` +
          `Si pregunta por "este cliente" o no nombra a nadie, es este.`,
      );
    }
  }
  if (ctx.projectId) {
    const proyecto = await prisma.project
      .findUnique({ where: { id: ctx.projectId }, select: { code: true, clientName: true } })
      .catch(() => null);
    if (proyecto) {
      lineas.push(
        `Tiene abierto el proyecto ${proyecto.clientName} (${proyecto.code}, project_id ${ctx.projectId}). ` +
          `Si pregunta por "este cliente" o no nombra a nadie, es este.`,
      );
    }
  }
  return lineas.join("\n");
}

/** Copia de la conversación con un punto de caché en el último bloque. */
function conCacheAlFinal(mensajes: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (mensajes.length === 0) return mensajes;
  const copia = mensajes.slice(0, -1);
  const ultimo = mensajes[mensajes.length - 1];
  const bloques: Anthropic.ContentBlockParam[] =
    typeof ultimo.content === "string" ? [{ type: "text", text: ultimo.content }] : [...ultimo.content];
  const i = bloques.length - 1;
  bloques[i] = { ...bloques[i], cache_control: { type: "ephemeral" } } as Anthropic.ContentBlockParam;
  copia.push({ role: ultimo.role, content: bloques });
  return copia;
}

export type RespuestaChat = {
  texto: string;
  modelo: keyof typeof MODELOS;
  modeloNombre: string;
  herramientas: string[];
  costoUsd: number;
};

export async function responder(args: {
  user: McpUser;
  conversacion: MensajeChat[];
  contexto: ContextoPantalla;
  modelo: ModeloElegido;
  /** Bloques de los archivos adjuntos al último mensaje (van antes de su texto). */
  adjuntos?: Anthropic.ContentBlockParam[];
  conDocumentos?: boolean;
}): Promise<RespuestaChat> {
  const ultimoMensaje = args.conversacion[args.conversacion.length - 1]?.content ?? "";
  const modelo = elegirModelo(args.modelo, ultimoMensaje, args.conDocumentos);
  const modelId = MODELOS[modelo].id;

  const herramientas = await abrirHerramientas(args.user);
  const usadas: string[] = [];
  let costoUsd = 0;

  try {
    const system: Anthropic.TextBlockParam[] = [
      { type: "text", text: instrucciones() },
      { type: "text", text: leerBase(), cache_control: { type: "ephemeral" } },
      { type: "text", text: await textoContexto(args.user, args.contexto) },
    ];
    const mensajes: Anthropic.MessageParam[] = args.conversacion.map((m) => ({ role: m.role, content: m.content }));
    if (args.adjuntos?.length) {
      const ultimo = mensajes[mensajes.length - 1];
      ultimo.content = [...args.adjuntos, { type: "text", text: ultimoMensaje }];
    }

    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      // `output_config` (esfuerzo) es más nuevo que los tipos del SDK instalado.
      const params = {
        model: modelId,
        max_tokens: 16000,
        system,
        tools: [HERRAMIENTA_ENCICLOPEDIA, ...herramientas.definiciones],
        messages: conCacheAlFinal(mensajes),
        output_config: { effort: "medium" },
      } as Anthropic.MessageCreateParamsNonStreaming;

      const res = await createMessage(cliente(), "asistente_chat", params, { userId: args.user.id });
      costoUsd +=
        costoAnthropic(modelId, {
          input: res.usage.input_tokens,
          output: res.usage.output_tokens,
          cacheRead: res.usage.cache_read_input_tokens ?? 0,
          cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
        }) ?? 0;

      if ((res.stop_reason as string) === "refusal") {
        return {
          texto: "No puedo responder ese pedido. Probá reformularlo.",
          modelo,
          modeloNombre: MODELOS[modelo].nombre,
          herramientas: usadas,
          costoUsd,
        };
      }

      const pedidos = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || pedidos.length === 0) {
        const texto = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n\n")
          .trim();
        return {
          texto: texto || "(sin respuesta)",
          modelo,
          modeloNombre: MODELOS[modelo].nombre,
          herramientas: usadas,
          costoUsd,
        };
      }

      // La respuesta vuelve entera (con sus bloques de razonamiento) y todos
      // los resultados van juntos en un solo mensaje.
      mensajes.push({ role: "assistant", content: res.content });
      const resultados = await Promise.all(
        pedidos.map(async (p) => {
          usadas.push(p.name);
          const r =
            p.name === HERRAMIENTA_ENCICLOPEDIA.name
              ? (() => {
                  const a = (p.input ?? {}) as { archivo?: string; seccion?: string };
                  return { texto: leerEnciclopedia(a.archivo ?? "", a.seccion), error: false };
                })()
              : await herramientas.llamar(p.name, p.input);
          return {
            type: "tool_result" as const,
            tool_use_id: p.id,
            content: r.texto,
            is_error: r.error || undefined,
          };
        }),
      );
      mensajes.push({ role: "user", content: resultados });
    }

    return {
      texto: "La consulta necesitó demasiados pasos y la corté. Probá con una pregunta más concreta.",
      modelo,
      modeloNombre: MODELOS[modelo].nombre,
      herramientas: usadas,
      costoUsd,
    };
  } finally {
    await herramientas.cerrar();
  }
}
