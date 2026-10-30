/**
 * El reloj del asistente de Instagram. Cada 10 segundos levanta las
 * conversaciones y los comentarios cuya espera al azar ya venció (guardada en
 * la base, así un reinicio no pierde respuestas); cada 10 minutos revisa los
 * seguimientos del día siguiente. Al arrancar siembra las automatizaciones que
 * falten.
 */

import { prisma } from "../../lib/prisma.js";
import { sembrarAutomatizaciones } from "./automatizaciones.js";
import * as comentarios from "./comentarios.js";
import { modoInstagram } from "./config.js";
import * as privados from "./privados.js";

const CADA_MS = 10_000;
const SEGUIMIENTOS_MS = 10 * 60_000;

/** Toma las conversaciones vencidas (cada una una sola vez) y las atiende en paralelo. */
export async function revisarPendientes(ahora = new Date()) {
  const convs = await prisma.instagramConversacion.findMany({
    where: { responderDesde: { lte: ahora } },
    select: { id: true, responderDesde: true },
    take: 20,
  });
  for (const c of convs) {
    // Solo si nadie la tomó entre medio (y si llegó otro mensaje, la espera se corrió).
    const tomada = await prisma.instagramConversacion.updateMany({
      where: { id: c.id, responderDesde: c.responderDesde },
      data: { responderDesde: null },
    });
    if (tomada.count) {
      void privados.atender(c.id).catch((err) => console.error("[instagram] falló el contestador:", err instanceof Error ? err.message : err));
    }
  }

  const coms = await prisma.instagramComentario.findMany({
    where: { estado: "PENDIENTE", atenderDesde: { lte: ahora } },
    select: { id: true },
    take: 20,
  });
  for (const c of coms) {
    const tomado = await prisma.instagramComentario.updateMany({ where: { id: c.id, estado: "PENDIENTE" }, data: { estado: "PROCESANDO" } });
    if (tomado.count) {
      void comentarios.atender(c.id).catch(async (err) => {
        console.error("[instagram] falló una automatización de comentarios:", err instanceof Error ? err.message : err);
        await prisma.instagramComentario.update({
          where: { id: c.id },
          data: { estado: "HECHO", resultado: "error", atendidoEn: new Date() },
        });
      });
    }
  }
}

let iniciado = false;

export function startInstagramJobs() {
  if (iniciado) return;
  iniciado = true;
  void sembrarAutomatizaciones()
    .then((creadas) => creadas.length && console.log(`[instagram] automatizaciones sembradas: ${creadas.join(", ")}`))
    .catch((err) => console.error("[instagram] no se pudieron sembrar las automatizaciones:", err));
  // Lo que quedó a medias por un reinicio vuelve a la cola.
  void prisma.instagramComentario
    .updateMany({ where: { estado: "PROCESANDO" }, data: { estado: "PENDIENTE" } })
    .catch(() => undefined);

  setInterval(() => {
    if (modoInstagram() === "apagado") return;
    revisarPendientes().catch((err) => console.error("[instagram] falló la revisión de pendientes:", err));
  }, CADA_MS).unref();
  setInterval(() => {
    privados.revisarSeguimientos().catch((err) => console.error("[instagram] falló la revisión de seguimientos:", err));
  }, SEGUIMIENTOS_MS).unref();
  console.log(`[instagram] asistente en modo ${modoInstagram()}`);
}
