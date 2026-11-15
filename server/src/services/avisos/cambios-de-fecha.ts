/**
 * Avisos al cliente cuando se confirma una fecha de obra.
 *
 *  - Lo normal: "Fecha de obra confirmada".
 *  - Si el cliente esperaba fecha nueva porque se le suspendió la obra
 *    (`Project.esperandoFechaNuevaDesde`): "Fecha nueva tras una suspensión", en
 *    lugar del de fecha confirmada, y se le borra la marca.
 *  - Pero si el aviso de la suspensión todavía no le había salido (tiene demora),
 *    el cliente no sabe que se suspendió: ese se cancela y sale el de "obra
 *    reprogramada", que le cuenta el cambio con la fecha nueva.
 *
 * Ver docs/manual/20-avisos-automaticos.md.
 */

import { prisma } from "../../lib/prisma.js";
import { emitirHecho } from "./emitir.js";

export async function avisarFechaConfirmada(projectId: string, primerDia: Date | null): Promise<void> {
  const ref = primerDia?.toISOString().slice(0, 10);
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { esperandoFechaNuevaDesde: true } });
  if (!p?.esperandoFechaNuevaDesde) {
    emitirHecho({ disparador: "obra.fecha_confirmada", projectId, ref });
    return;
  }

  await prisma.project.update({ where: { id: projectId }, data: { esperandoFechaNuevaDesde: null } });
  const suspensionSinSalir = await prisma.avisoEnvio.updateMany({
    where: { projectId, estado: "PROGRAMADO", aviso: { disparador: "obra.suspendida" } },
    data: {
      estado: "OMITIDO",
      detalle: "Antes de salir ya se confirmó la fecha nueva: le sale el aviso de obra reprogramada.",
    },
  });
  emitirHecho({
    disparador: suspensionSinSalir.count > 0 ? "obra.reprogramada" : "obra.fecha_nueva_tras_suspension",
    projectId,
    ref,
  });
}
