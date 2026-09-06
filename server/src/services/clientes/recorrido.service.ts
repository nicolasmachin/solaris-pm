/**
 * Los checks del recorrido de Experiencia Solar: creación, listado y completado.
 *
 * Se crean por demanda (la primera vez que se piden para un proyecto) en vez de
 * al crear el proyecto: así los ~95 clientes que ya existen entran al sistema sin
 * necesidad de un backfill, y un cambio en el catálogo alcanza a todos.
 */

import { AuditAction, AuditEntityType, type RecorridoCheck } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { addBusinessDays } from "../../utils/business-days.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { CHECKS_POR_RECORRIDO, CODIGO_REAGENDA } from "./recorrido-checks.js";

export type CheckSerializado = {
  id: string;
  recorrido: string;
  codigo: string;
  titulo: string;
  detalle: string | null;
  orden: number;
  venceEn: string | null;
  vencido: boolean;
  completado: boolean;
  completadoEn: string | null;
  completadoPor: string | null;
  nota: string | null;
  esDinamico: boolean;
};

function detalleDe(recorrido: string, codigo: string): string | null {
  const def = (CHECKS_POR_RECORRIDO[recorrido] ?? []).find((d) => d.codigo === codigo);
  return def?.detalle ?? null;
}

function serializar(c: RecorridoCheck & { completadoPor?: { name: string } | null }): CheckSerializado {
  return {
    id: c.id,
    recorrido: c.recorrido,
    codigo: c.codigo,
    titulo: c.titulo,
    detalle: detalleDe(c.recorrido, c.codigo),
    orden: c.orden,
    venceEn: c.venceEn?.toISOString() ?? null,
    // Vencido solo tiene sentido si además está pendiente: uno completado tarde
    // ya no es un pendiente, es historia.
    vencido: !c.completadoEn && !!c.venceEn && c.venceEn < new Date(),
    completado: !!c.completadoEn,
    completadoEn: c.completadoEn?.toISOString() ?? null,
    completadoPor: c.completadoPor?.name ?? null,
    nota: c.nota,
    esDinamico: c.esDinamico,
  };
}

/**
 * Asegura que existan los checks fijos del catálogo para un proyecto. Idempotente
 * (`skipDuplicates` sobre projectId+codigo), así que se puede llamar siempre.
 *
 * Los plazos NO se calculan acá: un check nace sin vencimiento y lo recibe cuando
 * ocurre el hecho que lo dispara (ver `activarCheck`). Poner el reloj a correr
 * desde la creación haría que todo naciera vencido.
 */
export async function ensureChecks(projectId: string): Promise<void> {
  const filas = Object.entries(CHECKS_POR_RECORRIDO).flatMap(([recorrido, defs]) =>
    defs.map((d) => ({
      projectId,
      recorrido,
      codigo: d.codigo,
      titulo: d.titulo,
      orden: d.orden,
    })),
  );
  await prisma.recorridoCheck.createMany({ data: filas, skipDuplicates: true });
}

/**
 * Arranca el reloj de un check porque ocurrió el hecho que lo dispara (se
 * confirmó la fecha de obra, UTE habilitó...). Si ya está completado o ya tenía
 * plazo, no lo toca.
 */
export async function activarCheck(projectId: string, codigo: string): Promise<void> {
  const def = Object.values(CHECKS_POR_RECORRIDO)
    .flat()
    .find((d) => d.codigo === codigo);
  if (!def?.plazoDiasHabiles) return;

  await ensureChecks(projectId);
  await prisma.recorridoCheck.updateMany({
    where: { projectId, codigo, completadoEn: null, venceEn: null },
    data: { venceEn: addBusinessDays(new Date(), def.plazoDiasHabiles) },
  });
}

/**
 * Crea un check dinámico por un hecho repetible: hoy, cada reprogramación de
 * obra. No se reutiliza el mismo check porque una casilla que se tilda una vez y
 * queda tildada para siempre es justo lo que hacía que no se avisara la segunda
 * reagenda.
 */
export async function crearCheckReagenda(
  projectId: string,
  motivo: string,
  fechaNueva: Date | null,
): Promise<void> {
  const previas = await prisma.recorridoCheck.count({
    where: { projectId, codigo: { startsWith: CODIGO_REAGENDA } },
  });
  const n = previas + 1;
  await prisma.recorridoCheck.create({
    data: {
      projectId,
      recorrido: "E1",
      codigo: `${CODIGO_REAGENDA}_${n}`,
      titulo: `Avisar la reprogramación de la obra (${n}ª)`,
      orden: 50 + n,
      // Se avisa el mismo día: el plazo es de un día hábil, no dos.
      venceEn: addBusinessDays(new Date(), 1),
      nota: [motivo, fechaNueva ? `Nueva fecha: ${fechaNueva.toISOString().slice(0, 10)}` : null]
        .filter(Boolean)
        .join(" · "),
      esDinamico: true,
    },
  });
}

export async function listarChecks(projectId: string): Promise<CheckSerializado[]> {
  await ensureChecks(projectId);
  const rows = await prisma.recorridoCheck.findMany({
    where: { projectId },
    include: { completadoPor: { select: { name: true } } },
    orderBy: [{ recorrido: "asc" }, { orden: "asc" }],
  });
  return rows.map(serializar);
}

export async function completarCheck(params: {
  checkId: string;
  userId: string;
  completado: boolean;
}): Promise<CheckSerializado> {
  const check = await prisma.recorridoCheck.findUnique({ where: { id: params.checkId } });
  if (!check) throw notFound("CHECK_NOT_FOUND", "El check no existe.");
  if (!!check.completadoEn === params.completado) {
    throw badRequest("CHECK_SIN_CAMBIO", "El check ya está en ese estado.");
  }

  const updated = await prisma.recorridoCheck.update({
    where: { id: params.checkId },
    data: params.completado
      ? { completadoEn: new Date(), completadoPorId: params.userId }
      : { completadoEn: null, completadoPorId: null },
    include: { completadoPor: { select: { name: true } } },
  });

  await createAuditEntry({
    entityType: AuditEntityType.project,
    entityId: check.projectId,
    projectId: check.projectId,
    userId: params.userId,
    action: AuditAction.updated,
    description: `${params.completado ? "Completó" : "Reabrió"} el paso de Experiencia Solar: "${check.titulo}"`,
  });

  return serializar(updated);
}
