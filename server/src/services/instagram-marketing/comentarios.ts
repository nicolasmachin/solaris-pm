/**
 * Automatizaciones que arrancan con un comentario en Instagram: los lead
 * magnets (palabra clave → privado con el contenido) y las respuestas a
 * comentarios con las reglas de Nicolás.
 *
 * 1. Meta avisa cada comentario (campo `comments`). Se descartan los de
 *    @voltia_uy y las respuestas dentro de un hilo; se elige la automatización
 *    prendida que lo toma (primero las de palabra clave) y se agenda para
 *    dentro de un rato al azar. El id del comentario es la llave: Meta
 *    reintenta y nunca se atiende dos veces.
 * 2. El job lo levanta. Claude, siguiendo el flujo escrito, devuelve la
 *    respuesta pública, el privado (solo si la automatización tiene link) o si
 *    hay que avisarle a Nicolás.
 * 3. El privado sale primero, como respuesta privada al comentario, y queda en
 *    la conversación de la persona con de dónde vino. Si no sale, no se dice
 *    en público que se mandó. Después la respuesta pública, con los controles
 *    de `responder` (publicación propia, nunca dos veces, tope diario).
 *
 * En modo sombra arma todo y no manda nada.
 */

import { prisma } from "../../lib/prisma.js";
import type { ComentarioAviso } from "./aviso.js";
import { type Automatizacion, completar, elegirParaComentario, textoComun, todas, una } from "./automatizaciones.js";
import { pedirJson } from "./claude.js";
import { IG, modoInstagram } from "./config.js";
import { ETIQUETA, etiquetar } from "./contactos.js";
import * as meta from "./meta.js";
import { MAXIMO_CARACTERES as MAXIMO_PRIVADO, anotarEnviado } from "./privados.js";
import { anotar, avisar, avisarGasto, superoElTope } from "./registro.js";

export const MAXIMO_PUBLICA = 500;
const DIA_MS = 24 * 3600_000;

export const ESQUEMA = {
  type: "object",
  properties: {
    respuesta_publica: { type: "string" },
    mensaje_privado: { type: "string" },
    avisar: { type: "boolean" },
    motivo: { type: "string" },
  },
  required: ["respuesta_publica", "mensaje_privado", "avisar", "motivo"],
  additionalProperties: false,
};

export type ResultadoComentario = {
  respuesta_publica?: string;
  mensaje_privado?: string;
  avisar?: boolean;
  motivo?: string;
};

export type DepsComentario = {
  claude: (auto: Automatizacion, c: ComentarioAviso, pub: meta.Publicacion, yaRecibio: boolean) => Promise<{
    resultado: ResultadoComentario | null;
    problema: string | null;
    costoUsd: number;
  }>;
  publicacion: (mediaId: string) => Promise<meta.Publicacion>;
  privado: (comentarioId: string, texto: string) => Promise<[string, string]>;
  responder: (comentarioId: string, texto: string, auto: Automatizacion) => Promise<void>;
  avisar: (asunto: string, cuerpo: string) => Promise<boolean>;
};

export const depsReales: DepsComentario = {
  claude: preguntarAClaude,
  publicacion: meta.publicacionPropia,
  privado: meta.privadoAComentario,
  responder: (id, texto, auto) => responder(id, texto, { tope: auto.topeDiario, origen: auto.id }),
  avisar: (asunto, cuerpo) => avisar(asunto, cuerpo),
};

// ── Recibir ─────────────────────────────────────────────────────────────────

/** Agenda un comentario del webhook. Devuelve el id de la automatización que lo va a atender, o null. */
export async function recibir(c: ComentarioAviso, ahora = new Date()): Promise<string | null> {
  if (modoInstagram() === "apagado") return null;
  if (c.deId === IG.cuenta || c.usuario.toLowerCase() === IG.usuario) return null; // nuestro (o de ManyChat)
  if (c.parentId) return null; // respuesta dentro de un hilo
  const auto = elegirParaComentario(await todas(), c.texto, c.mediaId);
  if (!auto) return null;
  const [minimo, maximo] = auto.espera;
  const creado = await prisma.instagramComentario.createMany({
    data: [
      {
        id: c.id,
        texto: c.texto,
        deId: c.deId || null,
        usuario: c.usuario || null,
        mediaId: c.mediaId || null,
        automatizacion: auto.id,
        atenderDesde: new Date(ahora.getTime() + (minimo + Math.random() * (maximo - minimo)) * 1000),
      },
    ],
    skipDuplicates: true,
  });
  return creado.count ? auto.id : null;
}

// ── Atender ─────────────────────────────────────────────────────────────────

async function yaRecibio(autoId: string, deId: string | null, usuario: string | null, ahora: Date): Promise<boolean> {
  if (!deId && !usuario) return false;
  const n = await prisma.instagramComentario.count({
    where: {
      automatizacion: autoId,
      sombra: false,
      mensajePrivado: { not: null },
      atendidoEn: { gte: new Date(ahora.getTime() - 30 * DIA_MS) },
      OR: [...(deId ? [{ deId }] : []), ...(usuario ? [{ usuario }] : [])],
    },
  });
  return n > 0;
}

async function terminar(id: string, datos: { resultado: string; publica?: string; privado?: string; sombra: boolean }) {
  await prisma.instagramComentario.update({
    where: { id },
    data: {
      estado: "HECHO",
      resultado: datos.resultado,
      respuestaPublica: datos.publica || null,
      mensajePrivado: datos.privado || null,
      sombra: datos.sombra,
      atendidoEn: new Date(),
    },
  });
}

/** Hace lo que dice la automatización con este comentario. Devuelve el resultado. */
export async function atender(id: string, deps: DepsComentario = depsReales, ahora = new Date()): Promise<string> {
  const fila = await prisma.instagramComentario.findUnique({ where: { id } });
  if (!fila) return "sin_comentario";
  const c: ComentarioAviso = {
    id: fila.id,
    texto: fila.texto,
    deId: fila.deId ?? "",
    usuario: fila.usuario ?? "",
    mediaId: fila.mediaId ?? "",
    parentId: "",
  };
  const modo = modoInstagram();
  const sombra = modo === "sombra";
  const base = { tipo: "comentario" as const, automatizacion: fila.automatizacion, comentarioId: c.id, persona: c.deId || null, usuario: c.usuario || null, sombra };

  const auto = await una(fila.automatizacion);
  if (modo === "apagado" || !auto?.activa) {
    await terminar(id, { resultado: "apagado", sombra });
    return "apagado";
  }
  if (await superoElTope(ahora)) {
    await terminar(id, { resultado: "tope_de_gasto", sombra });
    await anotar({ ...base, resultado: "no_contestado", razon: "tope_de_gasto" });
    await avisarGasto(ahora);
    return "tope_de_gasto";
  }
  let publicacion: meta.Publicacion;
  try {
    publicacion = await deps.publicacion(c.mediaId);
  } catch {
    await terminar(id, { resultado: "no_es_publicacion_propia", sombra });
    return "no_es_publicacion_propia";
  }

  const recibioAntes = Boolean(auto.link) && (await yaRecibio(auto.id, fila.deId, fila.usuario, ahora));
  const { resultado, problema, costoUsd } = await deps.claude(auto, c, publicacion, recibioAntes);
  await avisarGasto(ahora);
  const r: ResultadoComentario = resultado ?? { avisar: true, motivo: problema ?? "sin respuesta" };
  const publica = (r.respuesta_publica ?? "").trim().slice(0, MAXIMO_PUBLICA);
  let privado = (r.mensaje_privado ?? "").trim();
  const motivo = (r.motivo ?? "").trim();
  const datos = { texto: c.texto, link: publicacion.permalink ?? "", motivo };

  if (r.avisar) {
    if (!sombra) {
      await deps.avisar(
        `Instagram: comentario para mirar de @${c.usuario || "?"}`,
        `La automatización «${auto.nombre}» no lo contestó y avisa.\nMotivo: ${motivo || "sin motivo"}.\n\n` +
          `@${c.usuario}: «${c.texto}»\nEn: ${publicacion.permalink ?? ""}`,
      );
    }
    await terminar(id, { resultado: "avisado", sombra });
    await anotar({ ...base, resultado: "avisado", costoUsd, datos });
    return "avisado";
  }

  const mandaPrivado = Boolean(auto.link) && Boolean(privado) && !recibioAntes;
  if (mandaPrivado && !privado.includes(auto.link)) privado += `\n${auto.link}`;
  privado = privado.slice(0, MAXIMO_PRIVADO);

  if (sombra) {
    await terminar(id, { resultado: "sombra", publica, privado: mandaPrivado ? privado : "", sombra });
    await anotar({ ...base, resultado: publica || mandaPrivado ? "contestado" : "sin_respuesta", costoUsd, datos: { ...datos, publica, privado: mandaPrivado ? privado : "" } });
    return "sombra";
  }

  let privadoMid = "";
  let persona = "";
  if (mandaPrivado) {
    try {
      [persona, privadoMid] = await deps.privado(c.id, privado);
    } catch (err) {
      // Sin privado no se dice en público que se mandó (y si ManyChat lo mandó
      // primero, Meta rechaza el nuestro: no hay duplicados).
      await terminar(id, { resultado: "privado_fallido", sombra });
      await anotar({ ...base, resultado: "privado_fallido", costoUsd, datos: { ...datos, error: String(err instanceof Error ? err.message : err).slice(0, 300) } });
      return "privado_fallido";
    }
    await anotarEnviado({
      persona: persona || c.deId,
      mid: privadoMid,
      texto: privado,
      usuario: c.usuario,
      origen:
        `Comentó «${c.texto.slice(0, 80)}» en ${publicacion.permalink ?? "una publicación"} ` +
        `y la automatización «${auto.nombre}» le mandó por privado: ${auto.link}`,
    });
  }

  const palabra = auto.palabras[0]?.toUpperCase() ?? "";
  // Por usuario: no está confirmado que el id del comentario sea el de los
  // privados. Cuando sale el privado, Meta da el id de verdad y se unen.
  await etiquetar({ usuario: c.usuario, momento: ahora }, [`${ETIQUETA.COMENTO} ${palabra}`.trim()]);
  if (privadoMid) {
    await etiquetar({ persona: /^\d+$/.test(persona) ? persona : null, usuario: c.usuario, momento: ahora }, [`Recibió ${palabra || auto.id}`]);
  }

  let rechazo = "";
  let publicaOk = false;
  if (publica) {
    try {
      await deps.responder(c.id, publica, auto);
      publicaOk = true;
    } catch (err) {
      rechazo = err instanceof Error ? err.message : String(err);
    }
  }
  const hecho = publicaOk || privadoMid ? "contestado" : rechazo ? "rechazado" : "sin_respuesta";
  await terminar(id, { resultado: hecho, publica: publicaOk ? publica : "", privado: privadoMid ? privado : "", sombra });
  await anotar({ ...base, resultado: hecho, costoUsd, datos: { ...datos, publica: publicaOk ? publica : "", privado: privadoMid ? privado : "", rechazo } });
  return hecho;
}

// ── Contestar en público, con los controles ─────────────────────────────────

export class RespuestaRechazada extends Error {}

function inicioDeHoyUruguay(ahora: Date): Date {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(ahora);
  return new Date(`${hoy}T03:00:00.000Z`);
}

const autor = (x: { username?: string; from?: { username?: string } }) => x.username || x.from?.username || "";
const deVoltia = (x: { username?: string; from?: { id?: string; username?: string } }) =>
  x.from?.id === IG.cuenta || autor(x).toLowerCase() === IG.usuario;

/**
 * Publica la respuesta a un comentario, con los controles que no pueden
 * depender de Claude: hasta 500 caracteres, publicación propia, no es una
 * respuesta dentro de un hilo ni nuestro, nunca dos respuestas al mismo
 * (ni en la base ni en Instagram) y el tope diario por automatización.
 */
export async function responder(comentarioId: string, texto: string, opciones: { tope: number; origen: string }, ahora = new Date()) {
  texto = texto.trim();
  if (!texto) throw new RespuestaRechazada("La respuesta está vacía.");
  if (texto.length > MAXIMO_PUBLICA) throw new RespuestaRechazada(`La respuesta tiene ${texto.length} caracteres; el máximo es ${MAXIMO_PUBLICA}.`);
  const yaContestado = await prisma.instagramComentario.count({
    where: { id: comentarioId, respuestaPublica: { not: null }, sombra: false },
  });
  if (yaContestado) throw new RespuestaRechazada("Ese comentario ya se contestó: nunca dos respuestas al mismo.");
  const deHoy = await prisma.instagramComentario.count({
    where: { automatizacion: opciones.origen, respuestaPublica: { not: null }, sombra: false, atendidoEn: { gte: inicioDeHoyUruguay(ahora) } },
  });
  if (deHoy >= opciones.tope) throw new RespuestaRechazada(`Ya van ${deHoy} respuestas hoy; el tope es ${opciones.tope} por día.`);

  const com = await meta.comentario(comentarioId);
  if (com.parent_id) throw new RespuestaRechazada("Eso es una respuesta dentro de un hilo, no un comentario.");
  await meta.publicacionPropia(String(com.media?.id ?? ""));
  if (deVoltia(com)) throw new RespuestaRechazada("Ese comentario es de @voltia_uy.");
  const respuestas = com.replies?.data ?? [];
  if (respuestas.some((x) => !autor(x) && !x.from?.id)) {
    throw new RespuestaRechazada("No se ve quién escribió las respuestas que ya tiene: no se sabe si ya se contestó.");
  }
  if (respuestas.some(deVoltia)) throw new RespuestaRechazada("Ese comentario ya tiene una respuesta de @voltia_uy.");
  await meta.responderComentario(comentarioId, texto);
}

// ── Claude ──────────────────────────────────────────────────────────────────

async function recientes(autoId: string, cuantos = 8): Promise<[string[], string[]]> {
  const filas = await prisma.instagramComentario.findMany({
    where: { automatizacion: autoId, atendidoEn: { gte: new Date(Date.now() - 7 * DIA_MS) } },
    orderBy: { atendidoEn: "desc" },
    take: 40,
    select: { respuestaPublica: true, mensajePrivado: true },
  });
  const publicas = filas.map((f) => f.respuestaPublica).filter((x): x is string => !!x).slice(0, cuantos).reverse();
  const privados = filas.map((f) => f.mensajePrivado?.split("\n")[0]).filter((x): x is string => !!x).slice(0, cuantos).reverse();
  return [publicas, privados];
}

export function pedido(
  auto: Automatizacion,
  c: ComentarioAviso,
  pub: meta.Publicacion,
  yaRecibio: boolean,
  [publicas, privados]: [string[], string[]] = [[], []],
): string {
  const l = [
    `Comentario de @${c.usuario || "?"}: «${c.texto}»`,
    `Publicación: ${pub.permalink ?? ""}`,
    `Texto de la publicación: «${(pub.caption ?? "").slice(0, 600)}»`,
  ];
  if (auto.link) {
    l.push(`Link para el privado: ${auto.link}`);
    l.push(
      "Esta conversación: " +
        (yaRecibio ? "a esta persona YA se le mandó el privado de esta automatización antes." : "es la primera vez que comenta para recibirlo."),
    );
  }
  if (publicas.length) {
    l.push("Últimas respuestas públicas (no repitas ninguna, ni su estructura; variá el arranque y el cierre):");
    l.push(...publicas.map((t) => `- ${t}`));
  }
  if (privados.length) {
    l.push("Cómo arrancaron los últimos privados (arrancá distinto):");
    l.push(...privados.map((t) => `- ${t}`));
  }
  return l.join("\n");
}

async function preguntarAClaude(auto: Automatizacion, c: ComentarioAviso, pub: meta.Publicacion, yaRecibio: boolean) {
  const flujo = auto.flujo.replaceAll("{LINK}", auto.link);
  const instrucciones = completar(
    (await textoComun("_comentarios")).replace("{FLUJO}", flujo).replace("{DATOS}", completar(await textoComun("_datos"))),
  );
  return pedirJson<ResultadoComentario>({
    feature: "instagram_comentarios",
    instrucciones,
    mensajes: [{ role: "user", content: pedido(auto, c, pub, yaRecibio, await recientes(auto.id)) }],
    esquema: ESQUEMA,
    maxTokens: 2000,
    entityId: c.id,
  });
}

/** Lo que hizo cada automatización de comentarios en los últimos días. */
export async function resumenComentarios(dias = 7) {
  const desde = new Date(Date.now() - dias * DIA_MS);
  const filas = await prisma.instagramComentario.groupBy({
    by: ["automatizacion", "resultado", "sombra"],
    where: { creadoEn: { gte: desde } },
    _count: { _all: true },
  });
  return filas.map((f) => ({ automatizacion: f.automatizacion, resultado: f.resultado ?? "pendiente", sombra: f.sombra, cuantos: f._count._all }));
}

